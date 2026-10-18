// ---------- importing an Excel model: XML (src/excel-exporter/import/xml.js; step 20b) ----------
// A small XML reader for a workbook's parts, the same in the browser and in Node (no
// DOMParser): elements with their attributes, children and text. Element names lose their
// namespace prefix (x:c is c); attributes keep theirs (r:id). Only the five XML entities and
// character references are read; a document type (<!DOCTYPE …>) is refused, so no entity can
// grow the text. Comments and processing instructions are skipped; CDATA is text.

import { XlImportError } from './zip.js';

const XL_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: '\'' };

// Text with its entities read. An unknown entity stays as it was written.
export function xlXmlText(s){
  if(s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
    if(e[0] === '#'){
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10FFFF && !(code >= 0xD800 && code <= 0xDFFF) ? String.fromCodePoint(code) : m;
    }
    return Object.prototype.hasOwnProperty.call(XL_ENTITIES, e) ? XL_ENTITIES[e] : m;
  });
}

const XL_ATTR = /([^\s=\/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

// The document's root element: { name, attrs, children, text } (text: the element's own text,
// joined; children: its elements, in order).
export function xlParseXml(source){
  const root = { name: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const n = source.length;
  const broken = () => new XlImportError('broken', 'This workbook is damaged: a part is not readable XML.');
  while(i < n){
    const lt = source.indexOf('<', i);
    const textEnd = lt < 0 ? n : lt;
    if(textEnd > i){
      const top = stack[stack.length - 1];
      if(top !== root) top.text += xlXmlText(source.slice(i, textEnd));
    }
    if(lt < 0) break;
    if(source.startsWith('<!--', lt)){
      const e = source.indexOf('-->', lt + 4);
      if(e < 0) throw broken();
      i = e + 3;
    } else if(source.startsWith('<![CDATA[', lt)){
      const e = source.indexOf(']]>', lt + 9);
      if(e < 0) throw broken();
      stack[stack.length - 1].text += source.slice(lt + 9, e);
      i = e + 3;
    } else if(source.startsWith('<?', lt)){
      const e = source.indexOf('?>', lt + 2);
      if(e < 0) throw broken();
      i = e + 2;
    } else if(source.startsWith('<!', lt)){
      throw new XlImportError('broken', 'This workbook has a part with a document type, which the import refuses.');
    } else if(source[lt + 1] === '/'){
      const e = source.indexOf('>', lt);
      if(e < 0) throw broken();
      const name = xlLocal(source.slice(lt + 2, e).trim());
      const top = stack.pop();
      if(!top || top === root || top.name !== name) throw broken();
      i = e + 1;
    } else {
      // A start tag: find its end outside quoted attribute values.
      let e = lt + 1, quote = '';
      for(; e < n; e++){
        const ch = source[e];
        if(quote){ if(ch === quote) quote = ''; }
        else if(ch === '"' || ch === '\'') quote = ch;
        else if(ch === '>') break;
      }
      if(e >= n) throw broken();
      let body = source.slice(lt + 1, e);
      const selfClosing = body.endsWith('/');
      if(selfClosing) body = body.slice(0, -1);
      const m = /^[^\s]+/.exec(body);
      if(!m) throw broken();
      const el = { name: xlLocal(m[0]), attrs: {}, children: [], text: '' };
      XL_ATTR.lastIndex = m[0].length;
      let a;
      while((a = XL_ATTR.exec(body))) el.attrs[a[1]] = xlXmlText(a[3] !== undefined ? a[3] : a[4]);
      stack[stack.length - 1].children.push(el);
      if(!selfClosing) stack.push(el);
      i = e + 1;
    }
  }
  if(stack.length !== 1 || root.children.length !== 1) throw broken();
  return root.children[0];
}

function xlLocal(name){ const k = name.indexOf(':'); return k < 0 ? name : name.slice(k + 1); }

// The first child element called `name`, and all of them.
export function xlChild(el, name){ return el ? el.children.find(c => c.name === name) : undefined; }
export function xlChildren(el, name){ return el ? el.children.filter(c => c.name === name) : []; }

// An attribute by its name without a prefix (r:id and id alike), when no attribute has exactly that name.
export function xlAttr(el, name){
  if(!el) return undefined;
  if(Object.prototype.hasOwnProperty.call(el.attrs, name)) return el.attrs[name];
  for(const k of Object.keys(el.attrs)) if(xlLocal(k) === name) return el.attrs[k];
  return undefined;
}
