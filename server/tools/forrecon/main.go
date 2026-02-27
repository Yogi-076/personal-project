package main

import (
	"bufio"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// -- Configuration --

const (
	AppName    = "Forrecon-Alpha"
	AppVersion = "1.0.0"
)

var (
	targetURL    string
	wordlistPath string
	threads      int
	safeMode     bool
	outputFile   string
	extensions   string
)

// Anti-Soft-404 Baseline
type Baseline struct {
	Status        int
	ContentLength int64
	BodyHash      string
}

var baseline404 Baseline

// User-Agents for Evasion
var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
	"Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
}

// Result Structure (JSONL)
type Result struct {
	Timestamp   string `json:"timestamp"`
	URL         string `json:"url"`
	Status      int    `json:"status"`
	ContentType string `json:"content_type"`
	Length      int64  `json:"length"`
	WAFDetected string `json:"waf_detected,omitempty"`
	Redirect    string `json:"redirect,omitempty"`
}

var (
	resultsChan chan Result
	wg          sync.WaitGroup
)

func main() {
	// Parse CLI Flags
	flag.StringVar(&targetURL, "url", "", "Target URL (e.g., http://example.com)")
	flag.StringVar(&wordlistPath, "w", "", "Path to wordlist")
	flag.IntVar(&threads, "threads", 50, "Number of concurrent threads (default 50)")
	flag.BoolVar(&safeMode, "safe", false, "Enable Safe Mode (max 5 requests/sec)")
	flag.StringVar(&outputFile, "o", "results.jsonl", "Output file path")
	flag.StringVar(&extensions, "x", "", "File extensions to append (comma separated, e.g., .php,.txt)")
	flag.Parse()

	if targetURL == "" || wordlistPath == "" {
		fmt.Println("Usage: forrecon -url <target> -w <wordlist> [-threads 50] [-safe] [-o results.jsonl] [-x .php,.txt]")
		os.Exit(1)
	}

	// Validate flags
	if threads > 500 {
		threads = 500
	}
	if safeMode {
		threads = 1 // Force serial execution roughly, or control rate limiter
	}

	// Initialize Output
	resultsChan = make(chan Result, threads*2)
	go writer() // Start result writer

	// 1. Anti-Soft-404 Calibration
	fmt.Printf("[*] Calibrating Anti-Soft-404 logic for %s...\n", targetURL)
	calibrateBaseline()

	// 2. Load Wordlist
	fmt.Printf("[*] Loading wordlist from %s...\n", wordlistPath)
	words, err := loadWordlist(wordlistPath)
	if err != nil {
		fmt.Printf("[!] Error loading wordlist: %v\n", err)
		os.Exit(1)
	}
	
	// Add extensions
	var scanList []string
	exts := strings.Split(extensions, ",")
	for _, w := range words {
		scanList = append(scanList, w)
		if extensions != "" {
			for _, ext := range exts {
				if ext != "" {
					scanList = append(scanList, w+ext)
				}
			}
		}
	}

	fmt.Printf("[*] Starting scan with %d total requests (Threads: %d, Safe: %v)\n", len(scanList), threads, safeMode)

	// 3. Start Worker Pool
	jobs := make(chan string, len(scanList))
	
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go worker(jobs)
	}

	// 4. Feed Jobs
	for _, path := range scanList {
		jobs <- path
	}
	close(jobs)

	// 5. Wait for finish
	wg.Wait()
	close(resultsChan)
	
	// Give writer a moment to finish file IO
	time.Sleep(500 * time.Millisecond)
	fmt.Println("[*] Scan complete.")
}

func writer() {
	f, err := os.Create(outputFile)
	if err != nil {
		fmt.Printf("[!] Error creating output file: %v\n", err)
		return
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	for res := range resultsChan {
		// Also print to console
		statusColor := "\033[0m"
		if res.Status >= 200 && res.Status < 300 {
			statusColor = "\033[32m" // Green
		} else if res.Status >= 300 && res.Status < 400 {
			statusColor = "\033[33m" // Yellow
		} else if res.Status >= 400 && res.Status < 500 {
			statusColor = "\033[31m" // Red
		}

		fmt.Printf("%s[%d]%s %s (Size: %d) %s\n", statusColor, res.Status, "\033[0m", res.URL, res.Length, res.WAFDetected)
		
		err := enc.Encode(res)
		if err != nil {
			fmt.Printf("[!] Error writing JSON: %v\n", err)
		}
	}
}

func worker(jobs <-chan string) {
	defer wg.Done()
	
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
			TLSHandshakeTimeout: 5 * time.Second,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // Don't follow redirects automatically
		},
	}

	for path := range jobs {
		// Rate Limiting / Jitter
		if safeMode {
			time.Sleep(200 * time.Millisecond) // Max ~5 reqs/sec
		} else {
			// Random jitter 0-200ms
			time.Sleep(time.Duration(rand.Intn(200)) * time.Millisecond)
		}
		
		fullURL := fmt.Sprintf("%s/%s", strings.TrimRight(targetURL, "/"), strings.TrimLeft(path, "/"))
		
		req, err := http.NewRequest("GET", fullURL, nil)
		if err != nil {
			continue
		}

		// Random User-Agent
		req.Header.Set("User-Agent", userAgents[rand.Intn(len(userAgents))])

		resp, err := client.Do(req)
		if err != nil {
			// Handle timeout/refused gracefully
			continue
		}
		
		// Read Body for Analysis
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		// WAF Detection
		waf := detectWAF(resp)

		// Soft-404 Check
		bodyHash := md5Hash(bodyBytes)
		if isSoft404(resp.StatusCode, resp.ContentLength, bodyHash) {
			continue
		}

		// Filter noise (404s usually)
		if resp.StatusCode == 404 {
			continue
		}

		// Build Result
		result := Result{
			Timestamp: time.Now().Format(time.RFC3339),
			URL: fullURL,
			Status: resp.StatusCode,
			ContentType: resp.Header.Get("Content-Type"),
			Length: resp.ContentLength,
			WAFDetected: waf,
		}
		
		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			result.Redirect = resp.Header.Get("Location")
		}

		// Calculate length if unknown
		if result.Length == -1 {
			result.Length = int64(len(bodyBytes))
		}

		resultsChan <- result
	}
}

// Helpers

func loadWordlist(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		text := strings.TrimSpace(scanner.Text())
		if text != "" && !strings.HasPrefix(text, "#") {
			lines = append(lines, text)
		}
	}
	return lines, scanner.Err()
}

func calibrateBaseline() {
	// Send 3 requests to non-existent paths
	client := &http.Client{Timeout: 5 * time.Second}
	
	// We use the first response as baseline. Real tools average them.
	// Using a UUID ensures it doesn't exist.
	randomPath := uuid.New().String()
	fullURL := fmt.Sprintf("%s/%s", strings.TrimRight(targetURL, "/"), randomPath)

	req, _ := http.NewRequest("GET", fullURL, nil)
	req.Header.Set("User-Agent", userAgents[0])

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[!] Connection error during calibration: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	bodyBytes, _ := io.ReadAll(resp.Body)
	
	baseline404 = Baseline{
		Status:        resp.StatusCode,
		ContentLength: resp.ContentLength,
		BodyHash:      md5Hash(bodyBytes),
	}
	
	if baseline404.ContentLength == -1 {
		baseline404.ContentLength = int64(len(bodyBytes))
	}

	fmt.Printf("[*] Baseline 404 Profile: Status=%d, Len=%d, Hash=%s\n", baseline404.Status, baseline404.ContentLength, baseline404.BodyHash)
}

func isSoft404(status int, length int64, hash string) bool {
	// Simple comparison
	if status == baseline404.Status && hash == baseline404.BodyHash {
		return true
	}
	// Deviation allowance for length could be added here
	return false
}

func md5Hash(data []byte) string {
	hash := md5.Sum(data)
	return hex.EncodeToString(hash[:])
}

func detectWAF(resp *http.Response) string {
	server := resp.Header.Get("Server")
	if strings.Contains(strings.ToLower(server), "cloudflare") {
		return "Cloudflare"
	}
	if strings.Contains(strings.ToLower(server), "akamai") {
		return "Akamai"
	}
	
	// Cookies
	for _, cookie := range resp.Cookies() {
		if strings.Contains(cookie.Name, "__cfduid") {
			return "Cloudflare"
		}
		if strings.Contains(cookie.Name, "AWSALB") {
			return "AWS WAF"
		}
	}
	
	return ""
}
