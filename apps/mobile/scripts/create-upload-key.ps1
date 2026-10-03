$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path $PSScriptRoot -Parent
$credentialDirectory = Join-Path $mobileRoot '.credentials'
$keystore = Join-Path $credentialDirectory 'android-upload.keystore'
$propertiesFile = Join-Path $credentialDirectory 'android-signing.properties'
if ((Test-Path -LiteralPath $keystore) -or (Test-Path -LiteralPath $propertiesFile)) {
    throw 'Upload signing files already exist. This command never overwrites a key.'
}

$keytool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\keytool.exe' } else { (Get-Command keytool).Source }
if (-not (Test-Path -LiteralPath $keytool)) { throw 'JDK keytool was not found.' }
[void](New-Item -ItemType Directory -Path $credentialDirectory -Force)
# Restrict these new private files to this Windows account and SYSTEM.
$windowsIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $credentialDirectory /inheritance:r /grant:r "${windowsIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to the private signing directory.' }

$passwordBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $random.GetBytes($passwordBytes) } finally { $random.Dispose() }
$signingPassword = [System.BitConverter]::ToString($passwordBytes).Replace('-', '').ToLowerInvariant()
$previousPassword = $env:ROOM5_UPLOAD_KEY_GENERATION_PASSWORD
try {
    $env:ROOM5_UPLOAD_KEY_GENERATION_PASSWORD = $signingPassword
    & $keytool -genkeypair -noprompt -storetype PKCS12 -keystore $keystore -alias 'room5-upload' `
        -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Room5 Android Upload' `
        -storepass:env ROOM5_UPLOAD_KEY_GENERATION_PASSWORD -keypass:env ROOM5_UPLOAD_KEY_GENERATION_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Upload-key generation failed. Existing files were retained for inspection.' }
    $properties = @(
        'storeFile=android-upload.keystore'
        "storePassword=$signingPassword"
        'keyAlias=room5-upload'
        "keyPassword=$signingPassword"
    )
    [System.IO.File]::WriteAllLines($propertiesFile, $properties, [System.Text.Encoding]::ASCII)
    Write-Output "Upload keystore created: $keystore"
    Write-Output 'Alias: room5-upload. Passwords are saved only in the restricted private signing file.'
    Write-Output 'Back up BOTH private files securely before publishing; never commit or share them.'
} finally {
    $env:ROOM5_UPLOAD_KEY_GENERATION_PASSWORD = $previousPassword
    $signingPassword = $null
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
}
