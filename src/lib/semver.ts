/**
 * Semantic version comparison utilities
 * Implements proper semver comparison for the update system
 */

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse a semantic version string into components
 */
export function parseVersion(version: string): SemanticVersion {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');
  
  // Split on '+' to separate build metadata
  const [versionPart, build] = cleanVersion.split('+');
  
  // Split on '-' to separate prerelease
  const [corePart, prerelease] = versionPart.split('-');
  
  // Split core version into major.minor.patch
  const parts = corePart.split('.').map(part => parseInt(part, 10));
  
  // Ensure we have at least major.minor.patch
  while (parts.length < 3) {
    parts.push(0);
  }
  
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease,
    build,
  };
}

/**
 * Compare two semantic versions
 * Returns:
 *  1 if a > b
 *  0 if a === b
 * -1 if a < b
 */
export function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);
  
  // Compare major version
  if (versionA.major !== versionB.major) {
    return versionA.major > versionB.major ? 1 : -1;
  }
  
  // Compare minor version
  if (versionA.minor !== versionB.minor) {
    return versionA.minor > versionB.minor ? 1 : -1;
  }
  
  // Compare patch version
  if (versionA.patch !== versionB.patch) {
    return versionA.patch > versionB.patch ? 1 : -1;
  }
  
  // Compare prerelease versions
  if (versionA.prerelease && versionB.prerelease) {
    return comparePrerelease(versionA.prerelease, versionB.prerelease);
  }
  
  // Version without prerelease is greater than version with prerelease
  if (versionA.prerelease && !versionB.prerelease) {
    return -1;
  }
  
  if (!versionA.prerelease && versionB.prerelease) {
    return 1;
  }
  
  // Versions are equal
  return 0;
}

/**
 * Compare prerelease versions
 */
function comparePrerelease(a: string, b: string): number {
  const partsA = a.split('.');
  const partsB = b.split('.');
  
  const maxLength = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLength; i++) {
    const partA = partsA[i];
    const partB = partsB[i];
    
    // If one part is missing, the version with fewer parts is less
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    
    // Try to parse as numbers
    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    
    // If both are numbers, compare numerically
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) {
        return numA > numB ? 1 : -1;
      }
    } else {
      // Compare lexically
      if (partA !== partB) {
        return partA > partB ? 1 : -1;
      }
    }
  }
  
  return 0;
}

/**
 * Check if version A is greater than version B
 */
export function isVersionGreater(a: string, b: string): boolean {
  return compareVersions(a, b) === 1;
}

/**
 * Check if version A is less than version B
 */
export function isVersionLess(a: string, b: string): boolean {
  return compareVersions(a, b) === -1;
}

/**
 * Check if version A equals version B
 */
export function isVersionEqual(a: string, b: string): boolean {
  return compareVersions(a, b) === 0;
}

/**
 * Check if version A is greater than or equal to version B
 */
export function isVersionGreaterOrEqual(a: string, b: string): boolean {
  const result = compareVersions(a, b);
  return result === 1 || result === 0;
}

/**
 * Check if version A is less than or equal to version B
 */
export function isVersionLessOrEqual(a: string, b: string): boolean {
  const result = compareVersions(a, b);
  return result === -1 || result === 0;
}

/**
 * Check if a version satisfies a range (simplified semver range)
 * Supports: ^1.2.3, ~1.2.3, >=1.2.3, >1.2.3, <=1.2.3, <1.2.3, 1.2.3
 */
export function satisfiesRange(version: string, range: string): boolean {
  const trimmedRange = range.trim();
  
  // Exact match
  if (!trimmedRange.match(/^[~^<>=]/)) {
    return isVersionEqual(version, trimmedRange);
  }
  
  // Caret range (^1.2.3 - compatible within major version)
  if (trimmedRange.startsWith('^')) {
    const targetVersion = trimmedRange.slice(1);
    const target = parseVersion(targetVersion);
    const current = parseVersion(version);
    
    return current.major === target.major && 
           compareVersions(version, targetVersion) >= 0;
  }
  
  // Tilde range (~1.2.3 - compatible within minor version)
  if (trimmedRange.startsWith('~')) {
    const targetVersion = trimmedRange.slice(1);
    const target = parseVersion(targetVersion);
    const current = parseVersion(version);
    
    return current.major === target.major && 
           current.minor === target.minor && 
           compareVersions(version, targetVersion) >= 0;
  }
  
  // Greater than or equal
  if (trimmedRange.startsWith('>=')) {
    const targetVersion = trimmedRange.slice(2).trim();
    return isVersionGreaterOrEqual(version, targetVersion);
  }
  
  // Greater than
  if (trimmedRange.startsWith('>')) {
    const targetVersion = trimmedRange.slice(1).trim();
    return isVersionGreater(version, targetVersion);
  }
  
  // Less than or equal
  if (trimmedRange.startsWith('<=')) {
    const targetVersion = trimmedRange.slice(2).trim();
    return isVersionLessOrEqual(version, targetVersion);
  }
  
  // Less than
  if (trimmedRange.startsWith('<')) {
    const targetVersion = trimmedRange.slice(1).trim();
    return isVersionLess(version, targetVersion);
  }
  
  return false;
}

/**
 * Get the latest version from an array of version strings
 * Excludes prerelease versions by default
 */
export function getLatestVersion(versions: string[], includePrerelease = false): string | null {
  if (versions.length === 0) return null;
  
  const filteredVersions = includePrerelease 
    ? versions 
    : versions.filter(v => !parseVersion(v).prerelease);
  
  if (filteredVersions.length === 0) return null;
  
  return filteredVersions.reduce((latest, current) => {
    return compareVersions(current, latest) === 1 ? current : latest;
  });
}

/**
 * Sort versions in ascending order (oldest to newest)
 */
export function sortVersionsAscending(versions: string[]): string[] {
  return [...versions].sort(compareVersions);
}

/**
 * Sort versions in descending order (newest to oldest)
 */
export function sortVersionsDescending(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareVersions(b, a));
}

/**
 * Check if a version string is valid semver
 */
export function isValidVersion(version: string): boolean {
  try {
    const parsed = parseVersion(version);
    return !isNaN(parsed.major) && !isNaN(parsed.minor) && !isNaN(parsed.patch);
  } catch {
    return false;
  }
}

/**
 * Normalize a version string to standard semver format
 */
export function normalizeVersion(version: string): string {
  const parsed = parseVersion(version);
  let normalized = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  
  if (parsed.prerelease) {
    normalized += `-${parsed.prerelease}`;
  }
  
  if (parsed.build) {
    normalized += `+${parsed.build}`;
  }
  
  return normalized;
}

/**
 * Get version increment type between two versions
 */
export function getVersionIncrement(from: string, to: string): 'major' | 'minor' | 'patch' | 'prerelease' | 'none' {
  const fromVersion = parseVersion(from);
  const toVersion = parseVersion(to);
  
  if (toVersion.major > fromVersion.major) {
    return 'major';
  }
  
  if (toVersion.minor > fromVersion.minor) {
    return 'minor';
  }
  
  if (toVersion.patch > fromVersion.patch) {
    return 'patch';
  }
  
  if (fromVersion.prerelease && !toVersion.prerelease) {
    return 'prerelease';
  }
  
  if (fromVersion.prerelease !== toVersion.prerelease) {
    return 'prerelease';
  }
  
  return 'none';
}