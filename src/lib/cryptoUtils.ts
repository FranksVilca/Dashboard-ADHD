/**
 * Utilidades criptográficas para gestión segura de contraseñas.
 * Implementa PBKDF2 con HMAC-SHA256 y 10,000 iteraciones utilizando la API estándar Web Crypto.
 * Nunca almacena ni procesa contraseñas en texto plano.
 */

const PBKDF2_ITERATIONS = 10000;
const HASH_ALGORITHM = "SHA-256";
const KEY_LENGTH_BITS = 256;

/**
 * Genera una sal criptográfica segura de 16 bytes en formato hexadecimal.
 */
export function generateSalt(byteLength = 16): string {
  const randomBytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback defensivo
    for (let i = 0; i < byteLength; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convierte un ArrayBuffer a cadena hexadecimal.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convierte una cadena hexadecimal a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Genera un hash seguro de la contraseña utilizando PBKDF2-HMAC-SHA256 con sal única.
 */
export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  if (!password || typeof password !== "string") {
    throw new Error("La contraseña proporcionada es inválida.");
  }

  const salt = existingSalt || generateSalt();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBytes(salt);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );

  const hash = bufferToHex(derivedBits);
  return { hash, salt };
}

/**
 * Verifica si una contraseña candidata coincide con el hash almacenado.
 */
export async function verifyPassword(
  candidatePassword: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  if (!candidatePassword || !storedHash || !storedSalt) {
    return false;
  }

  try {
    const { hash } = await hashPassword(candidatePassword, storedSalt);
    // Comparación segura de cadenas
    if (hash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) {
      diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Valida reglas de seguridad para nuevas contraseñas.
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return {
      valid: false,
      message: "La contraseña debe tener al menos 6 caracteres.",
    };
  }
  if (password.length > 72) {
    return {
      valid: false,
      message: "La contraseña no debe superar los 72 caracteres.",
    };
  }
  return { valid: true };
}

/**
 * Valida el formato del nombre de usuario (alfanumérico, punto, guion o guion bajo, 3 a 30 caracteres).
 */
export function validateUsername(username: string): { valid: boolean; message?: string } {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 3) {
    return {
      valid: false,
      message: "El nombre de usuario debe contener al menos 3 caracteres.",
    };
  }
  if (trimmed.length > 30) {
    return {
      valid: false,
      message: "El nombre de usuario no puede exceder los 30 caracteres.",
    };
  }
  const usernameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      valid: false,
      message: "El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.",
    };
  }
  return { valid: true };
}
