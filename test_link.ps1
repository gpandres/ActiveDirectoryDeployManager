Import-Module GroupPolicy
 = New-GPO -Name 'test_cli'
 = \"{\" + $gpo.Id.ToString() + \"}\"
Write-Output 
New-GPLink -Name 'test_cli' -Target 'OU=Equipos,DC=pruebas,DC=local'
