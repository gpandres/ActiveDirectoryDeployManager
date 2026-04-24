const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-service-tests-'));
const execFileMock = vi.fn();

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

vi.mock('child_process', () => ({
  execFile: execFileMock
}));

vi.mock('../services/config', () => ({
  default: {
    getConfig: () => ({ preferredDC: '' })
  },
  getConfig: () => ({ preferredDC: '' })
}));

describe('ad-service unlink handling', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('treats the Spanish missing-link AD error as a successful unlink', async () => {
    execFileMock.mockImplementation((file, args, options, callback) => {
      const child = {
        kill: vi.fn(),
        on: (event, handler) => {
          if (event === 'exit') setImmediate(handler);
        }
      };

      setImmediate(() => {
        callback(
          null,
          JSON.stringify({
            ok: false,
            code: 'ERROR',
            error: 'No hay ningún GPO denominado Deploy_Notepad en el dominio superexport.local que esté vinculado al contenedor de Active Directory con la ruta de acceso LDAP "OU=Prueba,DC=superexport,DC=local".'
          }),
          ''
        );
      });

      return child;
    });

    const adService = require('../services/ad-service');
    const result = await adService.unlinkGPOfromOU(
      'Deploy_Notepad',
      'OU=Prueba,DC=superexport,DC=local'
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
