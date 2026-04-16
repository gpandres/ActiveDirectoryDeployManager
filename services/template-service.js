const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createShareStore } = require('./share-store');

let templatesFilePath = null;
const templatesShareStore = createShareStore('custom-templates.json');

function getTemplatesPath() {
  if (!templatesFilePath) {
    try {
      const electron = require('electron');
      const userDataPath = electron?.app?.getPath
        ? electron.app.getPath('userData')
        : os.tmpdir();
      templatesFilePath = path.join(userDataPath, 'custom-templates.json');
    } catch {
      templatesFilePath = path.join(os.tmpdir(), 'custom-templates.json');
    }
  }
  return templatesFilePath;
}

function loadTemplates() {
  const fromShare = templatesShareStore.read();
  if (fromShare !== null) {
    try {
      fs.writeFileSync(getTemplatesPath(), JSON.stringify(fromShare, null, 2), 'utf-8');
    } catch {}
    return Array.isArray(fromShare) ? fromShare.map(item => normalizeTemplate(item, { id: item?.id, createdAt: item?.createdAt, updatedAt: item?.updatedAt })) : [];
  }

  try {
    const filePath = getTemplatesPath();
    if (fs.existsSync(filePath)) {
      const localData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(localData) ? localData.map(item => normalizeTemplate(item, { id: item?.id, createdAt: item?.createdAt, updatedAt: item?.updatedAt })) : [];
    }
  } catch (err) {
    console.error('Error loading custom templates:', err);
  }

  return [];
}

function saveTemplates(templates) {
  const normalized = Array.isArray(templates)
    ? templates.map(item => normalizeTemplate(item, { id: item?.id, createdAt: item?.createdAt, updatedAt: item?.updatedAt }))
    : [];

  fs.writeFileSync(getTemplatesPath(), JSON.stringify(normalized, null, 2), 'utf-8');
  templatesShareStore.write(normalized);
}

function sanitizeText(value, maxLen = 512) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function sanitizeMultilineText(value, maxLen = 12000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').slice(0, maxLen);
}

function sanitizeToken(value, fallback = '') {
  const clean = typeof value === 'string'
    ? value.replace(/[^a-zA-Z0-9_\-./]/g, '').trim().slice(0, 96)
    : '';
  return clean || fallback;
}

function slugifyKey(value, fallback = 'item') {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 48);
  const finalKey = normalized || fallback;
  return /^[a-z_]/i.test(finalKey) ? finalKey : `item_${finalKey}`.slice(0, 48);
}

function sanitizeFileName(value) {
  if (typeof value !== 'string') return '';
  const base = path.basename(value.trim());
  const clean = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128);
  if (!clean || clean === '.' || clean === '..') return '';
  return clean;
}

function normalizeExtensions(value) {
  const raw = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split(/[\s,;]+/) : []);

  const cleaned = raw
    .map(item => String(item || '').replace(/^\./, '').trim().toLowerCase())
    .filter(item => item === '*' || /^[a-z0-9]+$/.test(item))
    .filter((item, index, arr) => arr.indexOf(item) === index);

  return cleaned.length > 0 ? cleaned : ['*'];
}

function normalizeJoiner(value) {
  return value === 'space' ? 'space' : '=';
}

function normalizeStorageKind(value) {
  return value === 'installer' ? 'installer' : 'file';
}

function asBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function defaultArgumentToken(index) {
  return `ARG${index + 1}`;
}

function normalizeArgumentField(field, index) {
  if (!field || typeof field !== 'object') return null;

  const token = sanitizeToken(field.token || field.name || field.label, defaultArgumentToken(index));
  const key = slugifyKey(field.key || token || field.label, `arg_${index + 1}`);

  return {
    key,
    label: sanitizeText(field.label || token, 80) || token,
    token,
    joiner: normalizeJoiner(field.joiner),
    quoteValue: asBoolean(field.quoteValue, true),
    required: asBoolean(field.required, false),
    hint: sanitizeText(field.hint, 180),
    defaultValue: sanitizeText(field.defaultValue || '', 256)
  };
}

function normalizeFileField(field, index) {
  if (!field || typeof field !== 'object') return null;

  const label = sanitizeText(field.label || field.argumentName || field.key || `File ${index + 1}`, 80) || `File ${index + 1}`;
  const key = slugifyKey(field.key || label, `file_${index + 1}`);

  return {
    key,
    label,
    storageKind: normalizeStorageKind(field.storageKind),
    argumentName: sanitizeToken(field.argumentName || '', ''),
    joiner: normalizeJoiner(field.joiner),
    quoteValue: asBoolean(field.quoteValue, true),
    required: asBoolean(field.required, false),
    hint: sanitizeText(field.hint, 180),
    destinationName: sanitizeFileName(field.destinationName || ''),
    extensions: normalizeExtensions(field.extensions)
  };
}

function dedupeByKey(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item?.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function isXmlFileField(field) {
  const extensions = Array.isArray(field?.extensions) ? field.extensions : [];
  return extensions.some(item => String(item || '').trim().toLowerCase() === 'xml');
}

function ensureLegacyXmlField(fieldsList, enabled) {
  if (!enabled) return fieldsList;
  if (fieldsList.some(isXmlFileField)) return fieldsList;

  const usedKeys = new Set(fieldsList.map(field => field.key));
  let key = 'config_xml';
  let counter = 2;
  while (usedKeys.has(key)) {
    key = `config_xml_${counter++}`;
  }

  return [
    ...fieldsList,
    {
      key,
      label: 'Archivo XML',
      storageKind: 'file',
      argumentName: '',
      joiner: '=',
      quoteValue: true,
      required: true,
      hint: 'XML solicitado por la plantilla',
      destinationName: 'config.xml',
      extensions: ['xml']
    }
  ];
}

function normalizeTemplate(input, options = {}) {
  const now = new Date().toISOString();
  const id = sanitizeToken(options.id || input?.id || `user-${crypto.randomUUID()}`, `user-${crypto.randomUUID()}`);
  const name = sanitizeText(input?.name, 120) || 'Nueva plantilla';
  const description = sanitizeText(input?.description, 240);
  const requiresConfigXml = asBoolean(input?.requiresConfigXml, false);
  const argumentsList = dedupeByKey(
    (Array.isArray(input?.arguments) ? input.arguments : [])
      .map((field, index) => normalizeArgumentField(field, index))
      .filter(Boolean)
  );
  const filesList = ensureLegacyXmlField(dedupeByKey(
    (Array.isArray(input?.files) ? input.files : [])
      .map((field, index) => normalizeFileField(field, index))
      .filter(Boolean)
  ), requiresConfigXml);

  return {
    id,
    kind: 'user-template',
    source: 'user',
    category: 'Custom',
    name,
    description,
    arguments: argumentsList,
    files: filesList,
    script: sanitizeMultilineText(input?.script || '', 30000),
    createdAt: options.createdAt || input?.createdAt || now,
    updatedAt: options.updatedAt || now
  };
}

function toWizardTemplate(template) {
  return {
    id: template.id,
    category: template.category || 'Custom',
    name: template.name,
    description: template.description || 'Plantilla personalizada',
    noInstaller: false,
    source: 'user',
    isUserDefined: true,
    fields: template.arguments.map(field => ({
      key: field.key,
      label: field.label,
      default: field.defaultValue || '',
      hint: field.hint || '',
      required: field.required === true,
      token: field.token,
      joiner: field.joiner,
      quoteValue: field.quoteValue !== false
    })),
    fileFields: template.files.map(field => ({
      key: field.key,
      label: field.label,
      hint: field.hint || '',
      storageKind: field.storageKind === 'installer' ? 'installer' : 'file',
      required: field.required === true,
      extensions: field.extensions,
      destinationName: field.destinationName || '',
      argumentName: field.argumentName || '',
      joiner: field.joiner,
      quoteValue: field.quoteValue !== false
    })),
    hasCustomScript: !!template.script
  };
}

const templateService = {
  getAll() {
    return loadTemplates().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  },

  get(id) {
    return this.getAll().find(item => item.id === id) || null;
  },

  getWizardTemplates() {
    return this.getAll().map(toWizardTemplate);
  },

  create(data) {
    const templates = this.getAll();
    const template = normalizeTemplate(data);
    templates.push(template);
    saveTemplates(templates);
    return template;
  },

  update(id, data) {
    const templates = this.getAll();
    const index = templates.findIndex(item => item.id === id);
    if (index === -1) return null;

    const current = templates[index];
    const updated = normalizeTemplate(
      { ...current, ...data },
      { id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() }
    );

    templates[index] = updated;
    saveTemplates(templates);
    return updated;
  },

  remove(id) {
    const templates = this.getAll();
    const filtered = templates.filter(item => item.id !== id);
    if (filtered.length === templates.length) {
      return { success: false, error: 'Template not found' };
    }
    saveTemplates(filtered);
    return { success: true };
  },

  resolve(templateId, snapshot) {
    if (snapshot && typeof snapshot === 'object' && snapshot.kind === 'user-template') {
      return normalizeTemplate(snapshot, {
        id: snapshot.id || templateId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt || snapshot.createdAt
      });
    }

    if (!templateId || typeof templateId !== 'string') return null;
    return this.get(templateId);
  }
};

module.exports = templateService;
