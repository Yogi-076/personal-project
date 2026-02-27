import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { DashboardShowcase } from "@/components/DashboardShowcase";
import { ArchitectureSection } from "@/components/ArchitectureSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <section id="dashboard">
          <DashboardShowcase />
        </section>
        <section id="architecture">
          <ArchitectureSection />
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Index;
