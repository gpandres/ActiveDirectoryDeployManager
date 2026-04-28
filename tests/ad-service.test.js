describe('ad-service unlink handling', () => {
  it('treats the Spanish missing-link AD error as a successful unlink', () => {
    const adService = require('../services/ad-service');
    const result = adService.__test__.normalizeUnlinkResult({
      ok: false,
      code: 'ERROR',
      error: 'No hay ningun GPO denominado Deploy_Notepad en el dominio superexport.local que este vinculado al contenedor de Active Directory con la ruta de acceso LDAP "OU=Prueba,DC=superexport,DC=local".'
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
