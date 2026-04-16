vi.mock('../services/config', () => ({
  default: { getConfig: () => ({ networkSharePath: '\\\\SERVER\\Share', language: 'en' }) },
  getConfig: () => ({ networkSharePath: '\\\\SERVER\\Share', language: 'en' })
}));

vi.mock('../services/i18n', () => ({
  default: { getTranslations: () => ({}) },
  getTranslations: () => ({})
}));

vi.mock('../services/template-service', () => ({
  default: {
    getWizardTemplates: () => ([
      {
        id: 'user-cid-template',
        category: 'Custom',
        name: 'CID Template',
        description: 'Custom template',
        fields: [],
        fileFields: [],
        noInstaller: false,
        isUserDefined: true
      }
    ]),
    resolve: (_id, snapshot) => (snapshot?.kind === 'user-template' ? snapshot : null)
  },
  getWizardTemplates: () => ([
    {
      id: 'user-cid-template',
      category: 'Custom',
      name: 'CID Template',
      description: 'Custom template',
      fields: [],
      fileFields: [],
      noInstaller: false,
      isUserDefined: true
    }
  ]),
  resolve: (_id, snapshot) => (snapshot?.kind === 'user-template' ? snapshot : null)
}));

const svc = require('../services/script-service');

function base(overrides = {}) {
  return {
    name: 'TestApp',
    version: '2.0.0',
    notifyUser: false,
    silentArgs: '/S',
    customParams: {},
    ...overrides
  };
}

describe('script-service user templates', () => {
  it('generates a script from a template snapshot with args, files and script', () => {
    const script = svc.generateScript(base({
      template: 'user-cid-template',
      customParams: { cid: 'ABC-123' },
      templateFiles: {
        office_xml: { sourcePath: 'C:\\temp\\office.xml' },
        helper_setup: { sourcePath: 'C:\\temp\\helper.exe' }
      },
      templateDefinition: {
        id: 'user-cid-template',
        kind: 'user-template',
        name: 'CID Custom',
        arguments: [
          { key: 'cid', label: 'CID', token: 'CID', joiner: '=', quoteValue: true, required: true, defaultValue: '' }
        ],
        files: [
          { key: 'office_xml', label: 'Office XML', argumentName: '/configure', joiner: 'space', quoteValue: true, destinationName: 'office.xml', extensions: ['xml'] },
          { key: 'helper_setup', label: 'Helper Setup', storageKind: 'installer', argumentName: '/helper', joiner: 'space', quoteValue: true, destinationName: 'helper.exe', extensions: ['exe'] }
        ],
        script: 'Copy-Item -Path $TemplateFiles.office_xml -Destination "C:\\Temp\\office.xml" -Force'
      }
    }));

    expect(script).toContain('$TemplateValues');
    expect(script).toContain('$TemplateFiles');
    expect(script).toContain('$ConfigXmlPath = if ($ConfigXmlName)');
    expect(script).toContain('office.xml');
    expect(script).toContain('attached-installers\\helper.exe');
    expect(script).toContain('CID=`"$($TemplateValues.cid)`"');
    expect(script).toContain('/configure `"$($TemplateFiles.office_xml)`"');
    expect(script).toContain('/helper `"$($TemplateFiles.helper_setup)`"');
    expect(script).toContain('Copy-Item -Path $TemplateFiles.office_xml');
  });
});
