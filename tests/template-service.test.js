const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-deploy-template-tests-'));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: () => tempRoot
    }
  },
  app: {
    getPath: () => tempRoot
  }
}));

vi.mock('../services/config', () => ({
  default: { getConfig: () => ({ networkSharePath: '', language: 'en' }) },
  getConfig: () => ({ networkSharePath: '', language: 'en' })
}));

const templateService = require('../services/template-service');

describe('template-service', () => {
  const templatesFile = path.join(tempRoot, 'custom-templates.json');
  const fallbackTemplatesFile = path.join(os.tmpdir(), 'custom-templates.json');

  beforeEach(() => {
    if (fs.existsSync(templatesFile)) {
      fs.unlinkSync(templatesFile);
    }
    if (fs.existsSync(fallbackTemplatesFile)) {
      fs.unlinkSync(fallbackTemplatesFile);
    }
  });

  it('creates and reads normalized custom templates', () => {
    const created = templateService.create({
      name: 'App con CID',
      description: 'Adds CID and XML support',
      arguments: [
        {
          label: 'Customer ID',
          token: 'CID',
          joiner: '=',
          quoteValue: true,
          required: true,
          hint: 'Falcon CID'
        }
      ],
      files: [
        {
          label: 'Helper Setup',
          storageKind: 'installer',
          argumentName: '/helper',
          joiner: 'space',
          quoteValue: true,
          required: false,
          destinationName: 'helper_setup.exe',
          extensions: 'exe'
        }
      ],
      script: 'Start-Process -FilePath $TemplateFiles.helper_setup -ArgumentList "/S" -Wait'
    });

    const all = templateService.getAll();
    expect(created.id).toMatch(/^user-/);
    expect(all).toHaveLength(1);
    expect(all[0].arguments[0].key).toBe('cid');
    expect(all[0].files[0].extensions).toEqual(['exe']);
    expect(all[0].files[0].storageKind).toBe('installer');
    expect(all[0].kind).toBe('user-template');
    expect(all[0].requiresConfigXml).toBeUndefined();
  });

  it('updates templates while preserving the id', () => {
    const created = templateService.create({
      name: 'Office XML',
      arguments: [{ label: 'CID', token: 'CID' }]
    });

    const updated = templateService.update(created.id, {
      name: 'Office XML Updated',
      files: [{ label: 'Config', extensions: 'xml,json', destinationName: '../config.xml' }]
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Office XML Updated');
    expect(updated.files[0].destinationName).toBe('config.xml');
    expect(updated.files[0].extensions).toEqual(['xml', 'json']);
  });

  it('exposes a wizard-friendly representation', () => {
    templateService.create({
      name: 'SAP XML',
      requiresConfigXml: true,
      arguments: [{ label: 'Customer ID', token: 'CID', required: true }],
      script: 'Write-Host "post install"'
    });

    const wizardTemplates = templateService.getWizardTemplates();
    expect(wizardTemplates).toHaveLength(1);
    expect(wizardTemplates[0].isUserDefined).toBe(true);
    expect(wizardTemplates[0].fields[0].required).toBe(true);
    expect(wizardTemplates[0].fileFields[0].extensions).toEqual(['xml']);
    expect(wizardTemplates[0].fileFields[0].required).toBe(true);
    expect(wizardTemplates[0].hasCustomScript).toBe(true);
  });
});
