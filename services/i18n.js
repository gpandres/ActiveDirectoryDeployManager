const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let langDir = null;

function getLangDir() {
  if (!langDir) {
    langDir = path.join(app.getPath('userData'), 'lang');
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }
  }
  return langDir;
}

const FALLBACK_EN = {
  nav: {
    dashboard: "Dashboard",
    ous: "Organizational Units",
    gpos: "GPO Management",
    apps: "Applications",
    bundles: "Bundles",
    deployments: "Deployments",
    settings: "Settings"
  },
  setup: {
    title: "Initial Configuration",
    subtitle: "Welcome to AD Deploy Manager. Please configure the basic settings to continue.",
    language: "Language",
    languageHint: "You can add more languages by putting .json files in the lang folder.",
    networkShare: "Network Share Path",
    networkShareHint: "UNC path where installers and scripts will be stored (e.g. \\\\server\\share).",
    browse: "Browse...",
    logsDir: "Logs Directory",
    logsDirHint: "Local path on target machines where installation logs will be saved.",
    defaultGpo: "Default GPO Name (Optional)",
    defaultGpoHint: "If specified, this GPO will be selected by default when creating new apps.",
    saveAndContinue: "Save and Continue"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Deployment System Overview",
    newApp: "New App",
    configuredApps: "Configured Apps",
    deployedFolders: "Deployed Folders",
    withGpo: "With Assigned GPO",
    bundles: "Bundles",
    healthStatus: "Health Status",
    healthOk: "healthy",
    healthWarn: "with warnings",
    healthError: "with errors",
    quickActions: "Quick Actions",
    createApp: "Create Application",
    createBundle: "Create Bundle",
    exploreOus: "Explore OUs",
    viewDeployments: "View Deployments",
    recentActivity: "Recent Activity",
    noActivity: "No activity recorded",
    adStatus: "AD Status",
    rsatOk: "RSAT Connected — Active Directory available",
    rsatMissing: "Missing RSAT — AD functionality limited",
    netShareChecking: "Checking network share...",
    netShareNotConfigured: "Network share not configured — ",
    goToSettings: "Go to Settings",
    netShareAccessible: "Network share accessible",
    netShareInaccessible: "Network share inaccessible",
    possibleCauses: "Possible causes:",
    cause1: "Computer is not connected to the domain",
    cause2: "RSAT is not installed",
    cause3: "Domain Controller is not accessible"
  },
  apps: {
    title: "Applications",
    subtitle: "Manage deployment packages and assignments",
    newApp: "New Application",
    refresh: "Refresh",
    search: "Search apps...",
    filterAll: "All",
    filterDeployed: "Deployed",
    filterNotDeployed: "Not Deployed",
    noAppsConfigured: "No apps configured yet.",
    clickNewApp: "Click 'New Application' to start.",
    script: "Script",
    disable: "Disable",
    deploy: "Deploy",
    edit: "Edit",
    selected: "selected",
    bulkDeploy: "Deploy Selected",
    bulkDelete: "Delete Selected",
    step1: "Template",
    step2: "Details",
    step3: "Targeting",
    step4: "Review",
    next: "Next",
    back: "Back",
    cancel: "Cancel",
    saveAndDeploy: "Save and Deploy",
    createAndDeploy: "Create and Deploy",
    appName: "Application Name",
    installer: "Installer (EXE/MSI)",
    browse: "Browse...",
    silentArgs: "Silent Arguments (Optional)",
    commonArgs: "Common args",
    version: "Version",
    notifyUser: "Notify user during installation",
    createGpoCheckbox: "Create a new GPO for this app automatically",
    selectGpo: "Select GPO (Optional)",
    selectOus: "Target Organizational Units",
    reviewSummary: "Configuration Summary",
    reviewAction: "Action",
    reviewFiles: "Files",
    argsHelpTitle: "Silent Installation Arguments",
    applyArg: "Apply Argument",
    deleteConfirm: "Delete Application",
    deleteMsg: "Are you sure you want to delete {app}?",
    cleanGpoOption: "Clean GPO (Unlink and details)",
    cleanSysvolOption: "Clean Scripts in SYSVOL",
    deleteGpoOption: "Delete physical GPO",
    keepFilesOption: "Keep files in network share",
    disableConfirm: "Disable Deployment",
    disableMsg: "This will remove the deployment script from the GPO but keep the app files.",
    appCreated: "App created successfully",
    appUpdated: "App updated successfully",
    appDeleted: "App deleted",
    deploySuccess: "App successfully deployed",
    toastTitleProcess: "Installation in progress",
    toastMsgProcess: "Installing $NombreApp. Please do not turn off your computer.",
    toastTitleDone: "Installation complete",
    toastMsgDone: "$NombreApp has been installed successfully. You can now continue."
  },
  bundles: {
    title: "Bundles",
    subtitle: "Group apps for bulk deployment via a single GPO",
    newBundle: "New Bundle",
    autoGpo: "Auto-GPO",
    appsIncluded: "Apps included",
    step1: "General",
    step2: "Apps",
    bundleName: "Bundle Name",
    desc: "Description",
    createGpo: "Create a dedicated GPO for this Bundle",
    selectApps: "Select Applications",
    emptyApps: "No apps available to include",
    reviewDesc: "Description:",
    reviewGpo: "GPO Management",
    createNewGpo: "Create new GPO:",
    deploying: "Deploying Bundle",
    deployingMsg: "Generating scripts and configuring GPOs...",
    bundleCreated: "Bundle created successfully",
    bundleDeleted: "Bundle deleted",
    bundleUpdated: "Bundle updated successfully",
    individualAppsNotDeleted: "Individual applications will not be deleted.",
    deleteBtn: "Deleting...",
    creatingGpo: "Creating GPO...",
    gpoCreatedBound: "GPO created and optionally linked",
    gpoError: "Error creating GPO: ",
    bundleDeployedWaitMsg: "Bundle deployed, but error creating GPO: ",
    bundleCreated: "Bundle created successfully",
    bundleDeleted: "Bundle deleted"
  },
  gpos: {
    title: "GPOs",
    subtitle: "Active Directory Group Policy Objects",
    refresh: "Refresh",
    newGpo: "New GPO",
    empty: "No GPOs found in AD.",
    gpoName: "GPO Name",
    linkedOus: "Linked OUs",
    status: "Status",
    enabled: "Enabled",
    createTitle: "Create New GPO",
    createMsg: "Enter the name for the new GPO:",
    createBtn: "Create GPO",
    deleteTitle: "Delete GPO",
    deleteMsg: "Are you sure you want to permanently delete GPO {gpo}?",
    deleteWarning: "You are about to permanently delete Group Policy: {gpo}",
    deleteConsequence: "It will be unlinked from all OUs and deleted from SYSVOL. Computers will lose this config on next refresh.",
    confirmDelete: "Yes, Delete GPO",
    deleting: "Deleting policy...",
    deletedSuccess: "Permanently deleted GPO",
    deleteFailed: "Failed to delete GPO",
    loading: "Loading GPOs from domain controller...",
    rsatMissing: "RSAT GPMC is not available. Cannot load GPOs.",
    empty: "No GPOs found in domain.",
    createdByApp: "Created by AppDeploy",
    errorConnecting: "Error connecting to AD:",
    id: "ID (GUID)",
    modified: "Modified",
    actions: "Actions",
    name: "GPO Name",
    gpoCreated: "GPO {gpo} created",
    gpoDeleted: "GPO {gpo} deleted"
  },
  ous: {
    title: "Organizational Units",
    subtitle: "Explore and manage AD structure",
    refresh: "Refresh",
    noData: "No OU data available.",
    selectOu: "Select an OU to see details",
    details: "OU Details",
    dn: "Distinguished Name",
    directGpos: "Direct GPOs",
    noGpos: "No GPOs directly linked",
    manageLinks: "Manage GPO Links",
    availableGpos: "Available GPOs",
    linkGpo: "Link GPO"
  },
  deployments: {
    title: "Deployments",
    subtitle: "Current contents of the network share",
    refresh: "Refresh",
    empty: "Empty Folder",
    emptyMsg: "No app folders found at",
    app: "Application",
    version: "Version",
    status: "Status",
    gpo: "GPO",
    files: "Files",
    lastMod: "Last Modified",
    seeMore: "See more",
    ready: "Ready",
    missingInstaller: "Missing Installer",
    missingScript: "Missing Script",
    hash: "Installer Hash (SHA-256)",
    clickToCopy: "Click to copy",
    hashCopied: "Hash copied to clipboard",
    deployedOn: "Deployment Date",
    details: "Details: ...",
    scanning: "Scanning network folder...",
    accessError: "Could not access the network share",
    pathConfigured: "Configured path",
    changePath: "Change path in Settings",
    emptyFolder: "Empty folder",
    noAppsInFolder: "No app folders found at",
    folders: "folder(s)",
    lastModified: "Last Modified",
    deployDate: "Deployment Date",
    close: "Close"
  },
  settings: {
    title: "Settings",
    subtitle: "Application configuration and preferences",
    general: "General Configuration",
    netShare: "Network Share",
    netShareHint: "UNC path to store scripts and installers.",
    browse: "Browse...",
    logs: "Logs Path",
    logsHint: "Local path on target PCs to store installation logs.",
    defaultGpo: "Default GPO",
    defaultGpoHint: "Default GPO to pre-select when creating apps.",
    language: "Interface Language",
    languageHint: "Choose the language for the application UI.",
    exportImport: "Configuration Backup",
    exportBtn: "Export DB",
    importBtn: "Import DB",
    save: "Save Configurations",
    saved: "Configuration saved successfully",
    dbExported: "Database exported to {path}",
    dbImported: "Database imported. Restarting app...",
    restartRequired: "The application needs to restart to apply the language change."
  },
  common: {
    yes: "Yes",
    no: "No",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    error: "Error",
    success: "Success",
    warning: "Warning"
  }
};

const DEFAULT_ES = {
  nav: {
    dashboard: "Dashboard",
    ous: "Unidades Organizativas",
    gpos: "Gestión de GPOs",
    apps: "Aplicaciones",
    bundles: "Bundles",
    deployments: "Despliegues",
    settings: "Configuración"
  },
  setup: {
    title: "Configuración Inicial",
    subtitle: "Bienvenido a AD Deploy Manager. Configura los ajustes básicos para continuar.",
    language: "Idioma",
    languageHint: "Puedes añadir más idiomas en la carpeta lang con archivos .json.",
    networkShare: "Carpeta de Red (Network Share)",
    networkShareHint: "Ruta UNC donde se guardarán instaladores y scripts (ej. \\\\servidor\\share).",
    browse: "Examinar...",
    logsDir: "Directorio de Logs",
    logsDirHint: "Ruta local en los PCs de destino para guardar logs de instalación.",
    defaultGpo: "Nombre GPO por defecto (Opcional)",
    defaultGpoHint: "Si se especifica, se pre-seleccionará al crear apps.",
    saveAndContinue: "Guardar y Continuar"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Vista general del sistema de despliegue",
    newApp: "Nueva App",
    configuredApps: "Apps Configuradas",
    deployedFolders: "Carpetas Desplegadas",
    withGpo: "Con GPO Asignada",
    bundles: "Bundles",
    healthStatus: "Estado de Salud",
    healthOk: "correctas",
    healthWarn: "con avisos",
    healthError: "con errores",
    quickActions: "Acciones Rápidas",
    createApp: "Crear Aplicación",
    createBundle: "Crear Bundle",
    exploreOus: "Explorar UOs",
    viewDeployments: "Ver Despliegues",
    recentActivity: "Actividad Reciente",
    noActivity: "Sin actividad registrada",
    adStatus: "Estado AD",
    rsatOk: "RSAT Conectado — Active Directory disponible",
    rsatMissing: "Sin RSAT — Funcionalidad AD limitada",
    netShareChecking: "Comprobando carpeta de red...",
    netShareNotConfigured: "Carpeta de red no configurada — ",
    goToSettings: "Ir a Configuración",
    netShareAccessible: "Carpeta de red accesible",
    netShareInaccessible: "Carpeta de red no accesible",
    possibleCauses: "Posibles causas:",
    cause1: "El equipo no está conectado al dominio",
    cause2: "RSAT no está instalado",
    cause3: "El controlador de dominio no es accesible"
  },
  apps: {
    title: "Aplicaciones",
    subtitle: "Gestiona los paquetes y asignaciones de despliegue",
    newApp: "Nueva Aplicación",
    refresh: "Actualizar",
    search: "Buscar aplicaciones...",
    filterAll: "Todas",
    filterDeployed: "Desplegadas",
    filterNotDeployed: "No Desplegadas",
    noAppsConfigured: "No hay aplicaciones configuradas aún.",
    clickNewApp: "Haz click en 'Nueva Aplicación' para empezar.",
    script: "Script",
    disable: "Deshabilitar",
    deploy: "Desplegar",
    edit: "Editar",
    selected: "seleccionadas",
    bulkDeploy: "Desplegar Selección",
    bulkDelete: "Eliminar Selección",
    step1: "Plantilla",
    step2: "Detalles",
    step3: "Objetivos",
    step4: "Revisión",
    next: "Siguiente",
    back: "Atrás",
    cancel: "Cancelar",
    saveAndDeploy: "Guardar y Desplegar",
    createAndDeploy: "Crear y Desplegar",
    appName: "Nombre de la Aplicación",
    installer: "Instalador (EXE/MSI)",
    browse: "Examinar...",
    silentArgs: "Argumentos silenciosos (opcionales)",
    commonArgs: "Argumentos comunes",
    version: "Versión",
    notifyUser: "Notificar al usuario durante instalación",
    createGpoCheckbox: "Crear una nueva GPO para esta app automáticamente",
    selectGpo: "Seleccionar GPO (Opcional)",
    selectOus: "Unidades Organizativas (Destino)",
    reviewSummary: "Resumen de Configuración",
    reviewAction: "Acción",
    reviewFiles: "Archivos",
    argsHelpTitle: "Argumentos de Instalación Silenciosa",
    applyArg: "Aplicar Argumento",
    deleteConfirm: "Eliminar Aplicación",
    deleteMsg: "¿Seguro que quieres eliminar {app}?",
    cleanGpoOption: "Limpiar GPO (Desvincular y detalles)",
    cleanSysvolOption: "Limpiar Scripts en SYSVOL",
    deleteGpoOption: "Eliminar GPO física de AD",
    keepFilesOption: "Mantener archivos en carpeta de red",
    disableConfirm: "Deshabilitar Despliegue",
    disableMsg: "Esto eliminará el script de notificación de la GPO, pero los archivos quedarán.",
    appCreated: "App creada exitosamente",
    appUpdated: "App actualizada exitosamente",
    appDeleted: "App eliminada",
    deploySuccess: "App desplegada correctamente",
    toastTitleProcess: "Instalación en proceso",
    toastMsgProcess: "Se está instalando $NombreApp. No apague el equipo.",
    toastTitleDone: "Instalación completada",
    toastMsgDone: "$NombreApp se ha instalado correctamente. Ya puede continuar."
  },
  bundles: {
    title: "Bundles",
    subtitle: "Agrupa apps para desplegarlas mediante una sola GPO",
    newBundle: "Nuevo Bundle",
    autoGpo: "Auto-GPO",
    appsIncluded: "Apps incluidas",
    step1: "General",
    step2: "Apps",
    bundleName: "Nombre del Bundle",
    desc: "Descripción",
    createGpo: "Crear una GPO dedicada para este Bundle",
    selectApps: "Seleccionar Aplicaciones",
    emptyApps: "No hay aplicaciones disponibles",
    reviewDesc: "Descripción:",
    reviewGpo: "Gestión de GPO:",
    createNewGpo: "Crear nueva GPO:",
    deploying: "Desplegando Bundle",
    deployingMsg: "Generando scripts y configurando GPOs...",
    bundleCreated: "Bundle creado con éxito",
    bundleDeleted: "Bundle eliminado",
    bundleUpdated: "Bundle actualizado con éxito",
    individualAppsNotDeleted: "Las aplicaciones individuales no se eliminarán.",
    deleteBtn: "Eliminando...",
    creatingGpo: "Creando GPO...",
    gpoCreatedBound: "GPO creada y vinculada correctamente",
    gpoError: "Error al crear la GPO: ",
    bundleDeployedWaitMsg: "Bundle desplegado, pero error al crear GPO: ",
    bundleDeleted: "Bundle eliminado"
  },
  gpos: {
    title: "GPOs",
    subtitle: "Directivas de Grupo de Active Directory",
    refresh: "Actualizar",
    newGpo: "Nueva GPO",
    empty: "No hay GPOs disponibles en AD.",
    gpoName: "Nombre GPO",
    linkedOus: "OUs Vinculadas",
    status: "Estado",
    enabled: "Habilitada",
    createTitle: "Crear Nueva GPO",
    createMsg: "Introduce el nombre para la nueva GPO:",
    createBtn: "Crear GPO",
    deleteTitle: "Eliminar GPO",
    deleteMsg: "¿Seguro que quieres eliminar permanentemente la GPO {gpo}?",
    deleteWarning: "Estás a punto de borrar definitivamente la Política de Grupo: {gpo}",
    deleteConsequence: "Se desvinculará de todas las Unidades Organizativas y se eliminará de SYSVOL. Los equipos perderán esta configuración en el próximo refresco.",
    confirmDelete: "Sí, Eliminar GPO",
    deleting: "Eliminando política...",
    deletedSuccess: "GPO eliminada permanentemente",
    deleteFailed: "Fallo al eliminar GPO",
    loading: "Cargando lista de GPOs desde el controlador de dominio...",
    rsatMissing: "RSAT GPMC no está disponible. No se pueden cargar GPOs.",
    empty: "No se encontraron GPOs en el dominio.",
    createdByApp: "Creada por AppDeploy",
    errorConnecting: "Error conectando con AD:",
    id: "ID (GUID)",
    modified: "Modificación",
    actions: "Acciones",
    name: "Nombre GPO",
    gpoCreated: "GPO {gpo} creada",
    gpoDeleted: "GPO {gpo} eliminada"
  },
  ous: {
    title: "Unidades Organizativas",
    subtitle: "Explora y gestiona la estructura de AD",
    refresh: "Actualizar",
    noData: "No hay datos de UOs disponibles.",
    selectOu: "Selecciona una UO para ver los detalles",
    details: "Detalles UO",
    dn: "Distinguished Name",
    directGpos: "GPOs Directas",
    noGpos: "Sin GPOs vinculadas directamente",
    manageLinks: "Gestionar Vínculos",
    availableGpos: "GPOs Disponibles",
    linkGpo: "Vincular GPO"
  },
  deployments: {
    title: "Despliegues",
    subtitle: "Contenido actual de la carpeta de red compartida",
    refresh: "Actualizar",
    empty: "Carpeta vacía",
    emptyMsg: "No se encontraron carpetas de apps en",
    app: "Aplicación",
    version: "Versión",
    status: "Estado",
    gpo: "GPO",
    files: "Archivos",
    lastMod: "Última Modificación",
    seeMore: "Ver más",
    ready: "Listo",
    missingInstaller: "Sin instalador",
    missingScript: "Sin script",
    hash: "Hash del Instalador (SHA-256)",
    clickToCopy: "Click para copiar",
    hashCopied: "Hash copiado al portapapeles",
    deployedOn: "Fecha de Despliegue",
    details: "Detalles: ...",
    scanning: "Escaneando carpeta de red...",
    accessError: "No se pudo acceder a la carpeta de red",
    pathConfigured: "Ruta configurada",
    changePath: "Cambiar ruta en Configuración",
    emptyFolder: "Carpeta vacía",
    noAppsInFolder: "No se encontraron carpetas de apps en",
    folders: "carpeta(s)",
    lastModified: "Última Modificación",
    deployDate: "Fecha de Despliegue",
    close: "Cerrar"
  },
  settings: {
    title: "Configuración",
    subtitle: "Ajustes de la aplicación y preferencias",
    general: "Configuración General",
    netShare: "Ruta de Red Compartida",
    netShareHint: "Ruta UNC para scripts y descargas.",
    browse: "Examinar...",
    logs: "Ruta local de Logs",
    logsHint: "Ruta en los PCs de destino para guardar logs.",
    defaultGpo: "GPO por defecto",
    defaultGpoHint: "GPO pre-seleccionada al crear apps.",
    language: "Idioma de la Interfaz",
    languageHint: "Elige el idioma general de la aplicación.",
    exportImport: "Respaldo y Restauración",
    exportBtn: "Exportar Base de Datos",
    importBtn: "Importar Base de Datos",
    save: "Guardar Cambios",
    saved: "Configuración guardada correctamente",
    dbExported: "Base de datos exportada en {path}",
    dbImported: "Base de datos importada. Reiniciando la app...",
    restartRequired: "Es necesario reiniciar la aplicación para aplicar el cambio de idioma."
  },
  common: {
    yes: "Sí",
    no: "No",
    cancel: "Cancelar",
    confirm: "Confirmar",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    error: "Error",
    success: "Éxito",
    warning: "Aviso"
  }
};

const i18nService = {
  initialize() {
    const dir = getLangDir();
    // Create ES file
    const esFile = path.join(dir, 'es.json');
    if (!fs.existsSync(esFile)) {
      fs.writeFileSync(esFile, JSON.stringify(DEFAULT_ES, null, 2), 'utf-8');
    }
    // Create EN file
    const enFile = path.join(dir, 'en.json');
    if (!fs.existsSync(enFile)) {
      fs.writeFileSync(enFile, JSON.stringify(FALLBACK_EN, null, 2), 'utf-8');
    }
  },

  getAvailableLanguages() {
    const dir = getLangDir();
    if (!fs.existsSync(dir)) return [{ code: 'en', name: 'English' }, { code: 'es', name: 'Español' }];
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const code = f.replace('.json', '');
      return {
        code,
        name: code.toUpperCase() // Could read from inside the json if we put a "langName" flag
      };
    });
  },

  getTranslations(langCode) {
    // If not found or empty, fallback to internal EN
    let translations = { ...FALLBACK_EN };

    try {
      const dir = getLangDir();
      const file = path.join(dir, langCode + '.json');
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        // Deep merge
        this._mergeDeep(translations, parsed);
      }
    } catch (e) {
      console.error('Error reading i18n file:', e);
    }

    return translations;
  },

  _mergeDeep(target, source) {
    if (this._isObject(target) && this._isObject(source)) {
      for (const key in source) {
        if (this._isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this._mergeDeep(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
  },

  _isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
};

module.exports = i18nService;
