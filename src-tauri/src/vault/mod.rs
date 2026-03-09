use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::RngCore;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

static CIPHER: OnceLock<Aes256Gcm> = OnceLock::new();

/// Initialize the vault by loading or creating a 256-bit key.
/// Must be called once at startup before encrypt/decrypt.
pub fn init(data_dir: &Path) -> Result<(), String> {
    let key_path = data_dir.join("vault.key");

    let key_bytes: [u8; 32] = if key_path.exists() {
        let bytes = fs::read(&key_path)
            .map_err(|e| format!("Failed to read vault key: {}", e))?;
        bytes
            .try_into()
            .map_err(|_| "Invalid vault key length (expected 32 bytes)".to_string())?
    } else {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        fs::create_dir_all(data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
        fs::write(&key_path, &key)
            .map_err(|e| format!("Failed to write vault key: {}", e))?;
        // Restrict file permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600))
                .map_err(|e| format!("Failed to set key file permissions: {}", e))?;
        }
        key
    };

    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    CIPHER
        .set(cipher)
        .map_err(|_| "Vault already initialized".to_string())?;

    Ok(())
}

/// Encrypt a plaintext string using AES-256-GCM.
/// Returns base64-encoded `nonce || ciphertext`.
pub fn encrypt_secret(value: &str) -> String {
    let cipher = CIPHER.get().expect("Vault not initialized — call vault::init() first");

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, value.as_bytes())
        .expect("AES-256-GCM encryption failed");

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    STANDARD.encode(&combined)
}

/// Decrypt a base64-encoded `nonce || ciphertext` string.
pub fn decrypt_secret(encrypted: &str) -> Result<String, String> {
    let cipher = CIPHER
        .get()
        .ok_or_else(|| "Vault not initialized — call vault::init() first".to_string())?;

    let combined = STANDARD
        .decode(encrypted)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    if combined.len() < 13 {
        return Err("Ciphertext too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong key or corrupted data".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 error: {}", e))
}
