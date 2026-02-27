/**
 * DastModule.js — Server-side port of PTK's ptk_module.js
 * 
 * Provides JSONLogic-based validation and proof extraction,
 * per-param atomic attack generation, and request mutation for
 * query params, body params, JSON body, cookies, and headers.
 * 
 * Ported from: pentestkit_ref/src/ptk/background/dast/modules/module.js
 */

const jsonLogic = require('json-logic-js');
const crypto = require('crypto');

// ── Utility helpers (ported from ptk_utils) ──
function attackId() {
    return crypto.randomBytes(8).toString('hex');
}
function attackParamId() {
    return 'ptk_' + crypto.randomBytes(4).toString('hex');
}

class DastModule {
    constructor(moduleDef) {
        Object.assign(this, moduleDef);

        // Parameters that should never be attacked
        this.nonAttackParams = ['csrf', '_csrf', /^x-.*-token$/i, /^ptk_/i];

        // Register custom JSONLogic operators
        jsonLogic.add_operation('regex', this.op_regex);
        jsonLogic.add_operation('proof', this.op_proof);
    }

    // ═══════════════════════════════════════════
    // JSONLogic Custom Operators
    // ═══════════════════════════════════════════

    op_regex(obj, pattern) {
        let success = false;
        const re = new RegExp(pattern, 'gmi');
        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (re.test(JSON.stringify(item))) {
                    success = true;
                    break;
                }
            }
        } else {
            success = re.test(obj);
        }
        return success;
    }

    op_proof(obj, pattern) {
        let proof = '';
        const re = new RegExp(pattern, 'gmi');
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const s = JSON.stringify(item);
                if (re.test(s)) {
                    proof = s.match(new RegExp(pattern, 'gmi'))?.[0] || '';
                    break;
                }
            }
        } else {
            if (re.test(obj)) {
                proof = obj.match(new RegExp(pattern, 'gmi'))?.[0] || '';
            }
        }
        return proof;
    }

    // ═══════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════

    isAttackableName(name) {
        const deny = this.nonAttackParams || [];
        const n = String(name ?? '').toLowerCase();
        return !deny.some(d => {
            if (d instanceof RegExp) return d.test(name);
            return String(d).toLowerCase() === n;
        });
    }

    _toURL(u, baseFallback) {
        try { return new URL(u); }
        catch { return new URL(u, baseFallback || 'http://localhost'); }
    }

    _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    _headersArray(schema) {
        return schema?.request?.headers || (schema.request.headers = []);
    }

    _findHeaderIndex(schema, name) {
        const headers = this._headersArray(schema);
        const lname = name.toLowerCase();
        return headers.findIndex(h => (h.name || '').toLowerCase() === lname);
    }

    _getHeader(schema, name) {
        const i = this._findHeaderIndex(schema, name);
        return i >= 0 ? this._headersArray(schema)[i].value : undefined;
    }

    _setHeader(schema, name, value) {
        const headers = this._headersArray(schema);
        const i = this._findHeaderIndex(schema, name);
        if (i >= 0) headers[i].value = value;
        else headers.push({ name, value });
    }

    _contentType(schema) {
        return (this._getHeader(schema, 'Content-Type') || schema?.request?.body?.mimeType || '').toLowerCase();
    }

    _looksJsonCt(ct) {
        return ct.includes('application/json') || ct.includes('text/json') || ct.includes('+json');
    }

    _ensureBody(schema) {
        if (!schema.request.body) schema.request.body = {};
        return schema.request.body;
    }

    _getJsonBody(schema) {
        const body = this._ensureBody(schema);
        const ct = this._contentType(schema);

        if (body.json && typeof body.json === 'object') {
            return { obj: body.json, source: 'json' };
        }
        if (this._looksJsonCt(ct) && typeof body.text === 'string') {
            try {
                const obj = JSON.parse(body.text);
                body.json = obj;
                return { obj, source: 'text' };
            } catch { /* ignore */ }
        }
        if (!this._looksJsonCt(ct) && typeof body.text === 'string') {
            try {
                const obj = JSON.parse(body.text);
                body.json = obj;
                this._setHeader(schema, 'Content-Type', 'application/json');
                return { obj, source: 'text' };
            } catch { /* ignore */ }
        }
        if (this._looksJsonCt(ct) && !body.text && !body.json) {
            body.json = {};
            return { obj: body.json, source: 'json' };
        }
        return { obj: null, source: null };
    }

    _persistJsonBody(schema, obj) {
        const body = this._ensureBody(schema);
        body.json = obj;
        try { body.text = JSON.stringify(obj); }
        catch { body.text = '' + obj; }
        if (!this._looksJsonCt(this._contentType(schema))) {
            this._setHeader(schema, 'Content-Type', 'application/json');
        }
    }

    _isPrimitive(v) {
        const t = typeof v;
        return v == null || t === 'string' || t === 'number' || t === 'boolean';
    }

    _enumerateJsonLeaves(obj, basePath = '') {
        const out = [];
        const addPath = (p) => (basePath ? `${basePath}.${p}` : p);
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const val = obj[i];
                const path = `${basePath}[${i}]`;
                if (this._isPrimitive(val)) out.push({ path, value: val });
                else if (val && typeof val === 'object') out.push(...this._enumerateJsonLeaves(val, path));
            }
        } else if (obj && typeof obj === 'object') {
            for (const k of Object.keys(obj)) {
                const val = obj[k];
                const path = addPath(k);
                if (this._isPrimitive(val)) out.push({ path, value: val });
                else if (val && typeof val === 'object') out.push(...this._enumerateJsonLeaves(val, path));
            }
        }
        return out;
    }

    // ═══════════════════════════════════════════
    // Cookie Helpers
    // ═══════════════════════════════════════════

    _parseCookieHeader(cookieStr) {
        const list = [];
        if (!cookieStr) return list;
        cookieStr.split(';').forEach(part => {
            const eq = part.indexOf('=');
            if (eq === -1) return;
            const name = part.slice(0, eq).trim();
            const value = part.slice(eq + 1).trim();
            if (name) list.push({ name, value });
        });
        return list;
    }

    _stringifyCookies(arr) {
        return (arr || []).map(c => `${c.name}=${c.value}`).join('; ');
    }

    _getCookiesArray(schema) {
        if (Array.isArray(schema?.request?.cookies)) return schema.request.cookies;
        const cookieHeader = this._getHeader(schema, 'Cookie') || '';
        const parsed = this._parseCookieHeader(cookieHeader);
        schema.request.cookies = parsed;
        return schema.request.cookies;
    }

    // ═══════════════════════════════════════════
    // Target Enumeration
    // ═══════════════════════════════════════════

    _getParamTargets(schema, action) {
        const targets = [];
        const qp = schema?.request?.queryParams || [];
        const bp = schema?.request?.body?.params || [];
        const hh = schema?.request?.headers || [];

        const actionHasWildcardParam = (action.params || []).some(a => !a.name);
        const actionHasWildcardHeader = (action.headers || []).some(a => !a.name);

        for (const p of qp) {
            if (!this.isAttackableName(p.name)) continue;
            const explicit = (action.params || []).some(a => a.name && a.name.toLowerCase() === p.name.toLowerCase());
            if (explicit || actionHasWildcardParam) targets.push({ location: 'query', name: p.name });
        }

        for (const p of bp) {
            if (!this.isAttackableName(p.name)) continue;
            const explicit = (action.params || []).some(a => a.name && a.name.toLowerCase() === p.name.toLowerCase());
            if (explicit || actionHasWildcardParam) targets.push({ location: 'body', name: p.name });
        }

        for (const h of hh) {
            if (!this.isAttackableName(h.name)) continue;
            if ((h.name || '').toLowerCase() === 'cookie') continue;
            const explicit = (action.headers || []).some(a => a.name && a.name.toLowerCase() === h.name.toLowerCase());
            if (explicit || actionHasWildcardHeader) targets.push({ location: 'header', name: h.name });
        }

        const hasCookieIntent = (action.cookies && action.cookies.length > 0) ||
            (action.headers || []).some(h => (h.name || '').toLowerCase() === 'cookie');
        if (hasCookieIntent) {
            const cookies = this._getCookiesArray(schema);
            for (const c of cookies) {
                if (!this.isAttackableName(c.name)) continue;
                targets.push({ location: 'cookie', name: c.name });
            }
        }

        const { obj: jsonObj } = this._getJsonBody(schema);
        if (jsonObj && (action.params?.length || 0) >= 0) {
            const explicitJsonNames = (action.params || []).filter(a => a.name && typeof a.name === 'string').map(a => a.name);
            if (explicitJsonNames.length) {
                for (const path of explicitJsonNames) targets.push({ location: 'json', name: path });
            } else if (actionHasWildcardParam) {
                const leaves = this._enumerateJsonLeaves(jsonObj);
                for (const leaf of leaves) targets.push({ location: 'json', name: leaf.path });
            }
        }

        return targets;
    }

    _recordMutation(list, location, name, before, after) {
        if (!list) return;
        if (before !== after) list.push({ location, name, before, after });
    }

    // ═══════════════════════════════════════════
    // Mutation Primitives
    // ═══════════════════════════════════════════

    modifyParam(name, param, action) {
        if (!this.isAttackableName(name) && name !== undefined && name !== null) return param;
        if (action.regex) {
            return String(param ?? '').replace(new RegExp(action.regex), action.value);
        } else if (action.operation === 'remove') {
            return '';
        } else if (action.operation === 'add') {
            return (action.position === 'after') ? (String(param ?? '') + action.value) : (action.value + String(param ?? ''));
        } else if (action.operation === 'replace') {
            return action.value;
        }
        return param;
    }

    modifyProps(schema, action) {
        // ptk_utils.jsonSetValueByPath equivalent
        for (let i = 0; i < (action.props?.length || 0); i++) {
            const parts = action.props[i].name.split('.');
            let obj = schema;
            for (let j = 0; j < parts.length - 1; j++) {
                if (!obj[parts[j]]) obj[parts[j]] = {};
                obj = obj[parts[j]];
            }
            obj[parts[parts.length - 1]] = action.props[i].value;
        }
        return schema;
    }

    modifyGetParams(schema, action, onlyName = null, mutations = null) {
        const urlObj = this._toURL(schema.request.url, schema.request.baseUrl);
        const params = schema.request.queryParams || (schema.request.queryParams = []);

        for (const a of (action.params || [])) {
            if (a.name) {
                if (onlyName && a.name.toLowerCase() !== onlyName.toLowerCase()) continue;
                const ind = params.findIndex(obj => obj.name?.toLowerCase() === a.name.toLowerCase());
                if (ind < 0) {
                    this._recordMutation(mutations, 'query', a.name, undefined, a.value);
                    params.push({ name: a.name, value: a.value });
                    urlObj.searchParams.set(a.name, a.value);
                } else {
                    const before = params[ind].value;
                    const after = this.modifyParam(params[ind].name, params[ind].value, a);
                    params[ind].value = after;
                    urlObj.searchParams.set(a.name, after);
                    this._recordMutation(mutations, 'query', params[ind].name, before, after);
                }
            } else {
                for (const p of params) {
                    if (onlyName && p.name?.toLowerCase() !== onlyName.toLowerCase()) continue;
                    const before = p.value;
                    const after = this.modifyParam(p.name, p.value, a);
                    p.value = after;
                    urlObj.searchParams.set(p.name, after);
                    this._recordMutation(mutations, 'query', p.name, before, after);
                }
            }
        }
        schema.request.url = urlObj.toString();
        return schema;
    }

    modifyPostParams(schema, action, onlyName = null, mutations = null) {
        const params = schema?.request?.body?.params;
        if (!params) return schema;

        for (const a of (action.params || [])) {
            if (a.name) {
                if (onlyName && a.name.toLowerCase() !== onlyName.toLowerCase()) continue;
                const ind = params.findIndex(obj => obj.name?.toLowerCase() === a.name.toLowerCase());
                if (ind < 0) {
                    this._recordMutation(mutations, 'body', a.name, undefined, a.value);
                    params.push({ name: a.name, value: a.value });
                } else {
                    const before = params[ind].value;
                    const after = this.modifyParam(params[ind].name, params[ind].value, a);
                    params[ind].value = after;
                    this._recordMutation(mutations, 'body', params[ind].name, before, after);
                }
            } else {
                for (const p of params) {
                    if (onlyName && p.name?.toLowerCase() !== onlyName.toLowerCase()) continue;
                    const before = p.value;
                    const after = this.modifyParam(p.name, p.value, a);
                    p.value = after;
                    this._recordMutation(mutations, 'body', p.name, before, after);
                }
            }
        }
        params.push({ name: 'ptk_rnd', value: attackParamId() });
        return schema;
    }

    modifyJsonParams(schema, action, onlyPath = null, mutations = null) {
        const { obj: jsonObj } = this._getJsonBody(schema);
        if (!jsonObj) return schema;

        const _parseJsonPath = (path) => {
            const segs = [];
            const re = /([^.\[\]]+)|\[(\d+)\]/g;
            let m;
            while ((m = re.exec(path)) !== null) {
                if (m[1] !== undefined) segs.push(m[1]);
                else segs.push(Number(m[2]));
            }
            return segs;
        };

        const _getByJsonPath = (obj, path) => {
            const segs = Array.isArray(path) ? path : _parseJsonPath(path);
            let cur = obj;
            for (let i = 0; i < segs.length; i++) {
                if (cur == null) return { exists: false, value: undefined };
                if (i === segs.length - 1) return { exists: Object.prototype.hasOwnProperty.call(cur, segs[i]), value: cur?.[segs[i]] };
                cur = cur?.[segs[i]];
            }
            return { exists: false, value: undefined };
        };

        const _setByJsonPath = (obj, path, value) => {
            const segs = Array.isArray(path) ? path : _parseJsonPath(path);
            let cur = obj;
            for (let i = 0; i < segs.length - 1; i++) {
                const k = segs[i];
                const next = segs[i + 1];
                if (cur[k] == null || typeof cur[k] !== 'object') {
                    cur[k] = (typeof next === 'number') ? [] : {};
                }
                cur = cur[k];
            }
            cur[segs[segs.length - 1]] = value;
        };

        const applyToPath = (path, act) => {
            const { exists, value } = _getByJsonPath(jsonObj, path);
            const before = exists ? value : undefined;
            const after = this.modifyParam(path, before, act);
            _setByJsonPath(jsonObj, path, after);
            this._recordMutation(mutations, 'json', path, before, after);
        };

        const hasExplicit = (action.params || []).some(a => a.name);
        if (hasExplicit) {
            for (const a of (action.params || [])) {
                if (!a.name) continue;
                if (onlyPath && a.name !== onlyPath) continue;
                applyToPath(a.name, a);
            }
        } else {
            const leaves = this._enumerateJsonLeaves(jsonObj);
            for (const leaf of leaves) {
                if (onlyPath && leaf.path !== onlyPath) continue;
                for (const a of (action.params || [])) {
                    applyToPath(leaf.path, a);
                }
            }
        }

        if (jsonObj && typeof jsonObj === 'object' && !Array.isArray(jsonObj)) {
            if (!Object.prototype.hasOwnProperty.call(jsonObj, 'ptk_rnd')) {
                jsonObj['ptk_rnd'] = attackParamId();
            }
        }
        this._persistJsonBody(schema, jsonObj);
        return schema;
    }

    modifyCookies(schema, action, onlyName = null, mutations = null) {
        const cookies = this._getCookiesArray(schema);

        let cookieActs = [];
        const cookieHeaderActs = (action.headers || []).filter(h => (h.name || '').toLowerCase() === 'cookie');
        const cookieHeaderAct = cookieHeaderActs.length ? cookieHeaderActs[0] : null;

        if (Array.isArray(action.cookies) && action.cookies.length) {
            cookieActs = action.cookies;
        } else if (cookieHeaderAct) {
            cookieActs = [{ name: onlyName || null, operation: cookieHeaderAct.operation, regex: cookieHeaderAct.regex, position: cookieHeaderAct.position, value: cookieHeaderAct.value }];
        }
        if (!cookieActs.length && !cookieHeaderAct) return schema;

        for (const act of cookieActs) {
            if (act.operation === 'remove' && act.regex && !act.name) {
                const r = new RegExp(act.regex);
                const toRemove = cookies.filter(c => r.test(String(c.value ?? ''))).map(c => c.name);
                for (const cname of toRemove) {
                    const idx = cookies.findIndex(c => (c.name || '').toLowerCase() === (cname || '').toLowerCase());
                    if (idx !== -1) {
                        this._recordMutation(mutations, 'cookie', cname, cookies[idx].value, undefined);
                        cookies.splice(idx, 1);
                    }
                }
                continue;
            }
            if (act.name) {
                if (onlyName && act.name.toLowerCase() !== onlyName.toLowerCase()) continue;
                const idx = cookies.findIndex(c => (c.name || '').toLowerCase() === act.name.toLowerCase());
                if (idx === -1) {
                    if (act.operation !== 'remove') {
                        const after = this.modifyParam(act.name, '', act);
                        cookies.push({ name: act.name, value: after });
                        this._recordMutation(mutations, 'cookie', act.name, undefined, after);
                    }
                } else {
                    const before = cookies[idx].value;
                    if (act.operation === 'remove') {
                        cookies.splice(idx, 1);
                        this._recordMutation(mutations, 'cookie', act.name, before, undefined);
                    } else {
                        const after = this.modifyParam(cookies[idx].name, cookies[idx].value, act);
                        cookies[idx].value = after;
                        this._recordMutation(mutations, 'cookie', cookies[idx].name, before, after);
                    }
                }
            } else if (onlyName) {
                const idx = cookies.findIndex(c => (c.name || '').toLowerCase() === onlyName.toLowerCase());
                if (idx >= 0) {
                    const before = cookies[idx].value;
                    if (act.operation === 'remove') {
                        cookies.splice(idx, 1);
                        this._recordMutation(mutations, 'cookie', onlyName, before, undefined);
                    } else {
                        const after = this.modifyParam(cookies[idx].name, cookies[idx].value, act);
                        cookies[idx].value = after;
                        this._recordMutation(mutations, 'cookie', cookies[idx].name, before, after);
                    }
                }
            } else {
                for (const c of [...cookies]) {
                    const before = c.value;
                    const after = this.modifyParam(c.name, c.value, act);
                    c.value = after;
                    this._recordMutation(mutations, 'cookie', c.name, before, after);
                }
            }
        }

        this._setHeader(schema, 'Cookie', this._stringifyCookies(cookies));
        return schema;
    }

    modifyHeaders(schema, action, onlyName = null, mutations = null) {
        const headers = this._headersArray(schema);
        for (const a of (action.headers || [])) {
            if ((a.name || '').toLowerCase() === 'cookie') continue;

            if (a.operation === 'remove') {
                if (a.name) {
                    for (let i = headers.length - 1; i >= 0; i--) {
                        if ((headers[i].name || '').toLowerCase() === a.name.toLowerCase()) {
                            this._recordMutation(mutations, 'header', headers[i].name, headers[i].value, undefined);
                            headers.splice(i, 1);
                        }
                    }
                    continue;
                }
                if (a.regex) {
                    const r = new RegExp(a.regex);
                    for (let i = headers.length - 1; i >= 0; i--) {
                        if (r.test(String(headers[i].value ?? ''))) {
                            this._recordMutation(mutations, 'header', headers[i].name, headers[i].value, undefined);
                            headers.splice(i, 1);
                        }
                    }
                    continue;
                }
            }

            if (a.name) {
                if (onlyName && a.name.toLowerCase() !== onlyName.toLowerCase()) continue;
                const ind = headers.findIndex(obj => obj.name?.toLowerCase() === a.name.toLowerCase());
                if (ind < 0) {
                    this._recordMutation(mutations, 'header', a.name, undefined, a.value);
                    headers.push({ name: a.name, value: a.value });
                } else {
                    const before = headers[ind].value;
                    const after = this.modifyParam(headers[ind].name, headers[ind].value, a);
                    headers[ind].value = after;
                    this._recordMutation(mutations, 'header', headers[ind].name, before, after);
                }
            } else {
                for (const h of headers) {
                    if (onlyName && h.name?.toLowerCase() !== onlyName.toLowerCase()) continue;
                    const before = h.value;
                    const after = this.modifyParam(h.name, h.value, a);
                    h.value = after;
                    this._recordMutation(mutations, 'header', h.name, before, after);
                }
            }
        }
        return schema;
    }

    modifyUrl(schema, action) {
        const url = this._toURL(schema.request.url, schema.request.baseUrl);
        schema.request.url = url.origin + action.url.value;
        return schema;
    }

    // ═══════════════════════════════════════════
    // Attack Preparation
    // ═══════════════════════════════════════════

    prepareAttack(a) {
        const attack = this._clone(a);
        const rnd = attackParamId();

        if (attack.action?.random) attack.action.random = rnd;
        const rep = (s) => (typeof s === 'string' ? s.replaceAll('%%random%%', rnd) : s);

        for (const arr of ['props', 'params', 'headers', 'cookies']) {
            for (const item of (attack.action?.[arr] || [])) {
                if (typeof item.value === 'string') item.value = rep(item.value);
            }
        }

        if (attack?.regex) {
            const asString = JSON.stringify(attack.regex);
            attack.regex = JSON.parse(asString.replaceAll('%%random%%', rnd));
        }

        return attack;
    }

    // ═══════════════════════════════════════════
    // Build Attacks (atomic per-param or bulk)
    // ═══════════════════════════════════════════

    buildAttacks(schema, attack, options = {}) {
        const prepared = this.prepareAttack(attack);
        if (!prepared?.action) return [];

        const forcedMode = options?.mode;
        let atomic = prepared.atomic !== false;
        if (forcedMode === 'bulk') atomic = false;
        else if (forcedMode === 'per-param') atomic = true;

        const attacks = [];

        if (!atomic) {
            attacks.push(this.buildAttack(schema, prepared));
            return attacks;
        }

        // Atomic: one attack per target (query/body/header/json/cookie)
        const targets = this._getParamTargets(schema, prepared.action);

        if (!targets.length && !prepared.action.params && !prepared.action.headers && !prepared.action.cookies) {
            attacks.push(this.buildAttack(schema, prepared));
            return attacks;
        }

        for (const tgt of targets) {
            const _schema = this._clone(schema);
            const mutations = [];

            if (prepared.action.url) this.modifyUrl(_schema, prepared.action);
            if (prepared.action.props) this.modifyProps(_schema, prepared.action);

            if (tgt.location === 'query') {
                if (prepared.action.params?.length) this.modifyGetParams(_schema, prepared.action, tgt.name, mutations);
            } else if (tgt.location === 'body') {
                if (prepared.action.params?.length) this.modifyPostParams(_schema, prepared.action, tgt.name, mutations);
            } else if (tgt.location === 'json') {
                if (prepared.action.params?.length) this.modifyJsonParams(_schema, prepared.action, tgt.name, mutations);
            } else if (tgt.location === 'cookie') {
                if ((prepared.action.cookies && prepared.action.cookies.length) ||
                    (prepared.action.headers || []).some(h => (h.name || '').toLowerCase() === 'cookie')) {
                    this.modifyCookies(_schema, prepared.action, tgt.name, mutations);
                }
            } else if (tgt.location === 'header') {
                if (prepared.action.headers?.length) this.modifyHeaders(_schema, prepared.action, tgt.name, mutations);
            }

            // Cookie sync
            const cookieIndex = (_schema.request.headers || []).findIndex(i => (i.name || '').toLowerCase() === 'cookie');
            if (cookieIndex > -1) {
                _schema.request.cookies = this._parseCookieHeader(_schema.request.headers[cookieIndex].value || '');
            }

            _schema.metadata = _schema.metadata || {};
            _schema.metadata.mutations = mutations;
            if (!mutations.length) continue;
            _schema.metadata.attacked = mutations[0];

            attacks.push(_schema);
        }

        return attacks;
    }

    buildAttack(schema, attack) {
        let _schema = this._clone(schema);
        const mutations = [];

        if (attack.action.url) _schema = this.modifyUrl(_schema, attack.action);
        if (attack.action.props) _schema = this.modifyProps(_schema, attack.action);

        if (attack.action.params) {
            const method = (_schema.request.method || 'GET').toUpperCase();
            const hasBodyMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
            const { obj: jsonObj } = this._getJsonBody(_schema);

            if (hasBodyMethod && jsonObj) _schema = this.modifyJsonParams(_schema, attack.action, null, mutations);
            else if (hasBodyMethod) _schema = this.modifyPostParams(_schema, attack.action, null, mutations);
            else _schema = this.modifyGetParams(_schema, attack.action, null, mutations);
        }

        if ((attack.action.cookies && attack.action.cookies.length) ||
            (attack.action.headers || []).some(h => (h.name || '').toLowerCase() === 'cookie')) {
            _schema = this.modifyCookies(_schema, attack.action, null, mutations);
        }
        if (attack.action.headers) _schema = this.modifyHeaders(_schema, attack.action, null, mutations);

        const cookieIndex = (_schema.request.headers || []).findIndex(item => (item.name || '').toLowerCase() === 'cookie');
        if (cookieIndex > -1) {
            _schema.request.cookies = this._parseCookieHeader(_schema.request.headers[cookieIndex].value || '');
        }

        _schema.metadata = _schema.metadata || {};
        _schema.metadata.mutations = mutations;
        if (mutations.length) _schema.metadata.attacked = mutations[0];
        else _schema.metadata.attacked = { location: 'unknown', name: '' };

        return _schema;
    }

    // ═══════════════════════════════════════════
    // Validation
    // ═══════════════════════════════════════════

    validateAttackConditions(attack, original) {
        return jsonLogic.apply(attack.metadata?.condition, { original, attack, module: this });
    }

    validateAttack(executed, original) {
        if (executed) {
            const success = jsonLogic.apply(executed.metadata?.validation?.rule, { attack: executed, original, module: this });
            let proof = '';
            if (executed.metadata?.validation?.proof && success) {
                proof = jsonLogic.apply(executed.metadata.validation.proof, { attack: executed, original, module: this });
            }
            if (success && !proof) {
                proof = this._buildBaselineProof(executed, original);
            }
            return {
                success: !!success,
                proof: proof,
                detector: executed.metadata?.validation?.type || executed.metadata?.validation?.detector || null,
                match: proof || null
            };
        }
        return { success: false, proof: '' };
    }

    _buildBaselineProof(attack, original) {
        const attackRes = attack?.response || {};
        const origRes = original?.response || {};
        const statusMatch = attackRes?.statusCode != null && origRes?.statusCode != null
            && Number(attackRes.statusCode) === Number(origRes.statusCode);
        const bodyMatch = typeof attackRes?.body === 'string' && typeof origRes?.body === 'string'
            && attackRes.body === origRes.body;
        if (statusMatch && bodyMatch) return 'Attack response matches baseline (status and body).';
        if (statusMatch) return 'Attack response status matches baseline.';
        if (bodyMatch) return 'Attack response body matches baseline.';
        return '';
    }
}

module.exports = { DastModule, attackId, attackParamId };
