import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  compareVersions, 
  parseVersion,
  isVersionGreater,
  isVersionLess,
  isVersionEqual,
  isVersionGreaterOrEqual,
  isVersionLessOrEqual,
  normalizeVersion,
  sortVersionsAscending,
  sortVersionsDescending
} from '../../src/lib/semver';

/**
 * Property-Based Tests for Semantic Version Comparison
 * 
 * **Feature: kiyya-desktop-streaming, Property 17: Version Comparison Accuracy**
 * 
 * For any two semantic version strings, the comparison function should correctly 
 * determine their relative order according to semantic versioning rules (major.minor.patch), 
 * handling edge cases like missing patch versions.
 * 
 * Validates: Requirements 19.3, 8.2
 */

// Arbitrary generators for semantic versions
const versionNumberArb = fc.integer({ min: 0, max: 999 });

const semverArb = fc.record({
  major: versionNumberArb,
  minor: versionNumberArb,
  patch: versionNumberArb,
  prerelease: fc.option(fc.oneof(
    fc.constant('alpha'),
    fc.constant('beta'),
    fc.constant('rc'),
    fc.stringOf(fc.constantFrom('alpha', 'beta', 'rc', '.', '0', '1', '2', '3'), { minLength: 1, maxLength: 10 })
  ), { nil: undefined }),
  build: fc.option(fc.stringOf(fc.constantFrom('build', '.', '0', '1', '2', '3'), { minLength: 1, maxLength: 10 }), { nil: undefined })
}).map(({ major, minor, patch, prerelease, build }) => {
  let version = `${major}.${minor}.${patch}`;
  if (prerelease) version += `-${prerelease}`;
  if (build) version += `+${build}`;
  return version;
});

// Arbitrary for version strings with optional components
const partialVersionArb = fc.oneof(
  fc.tuple(versionNumberArb).map(([major]) => `${major}`),
  fc.tuple(versionNumberArb, versionNumberArb).map(([major, minor]) => `${major}.${minor}`),
  semverArb
);

// Arbitrary for version strings with optional 'v' prefix
const versionWithPrefixArb = fc.tuple(
  fc.boolean(),
  semverArb
).map(([hasPrefix, version]) => hasPrefix ? `v${version}` : version);

describe('Property-Based Tests: Semantic Version Comparison', () => {
  describe('Property 17: Version Comparison Accuracy', () => {
    it('should satisfy reflexivity: compareVersions(a, a) === 0', () => {
      fc.assert(
        fc.property(semverArb, (version) => {
          expect(compareVersions(version, version)).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should satisfy antisymmetry: if compareVersions(a, b) === 1, then compareVersions(b, a) === -1', () => {
      fc.assert(
        fc.property(semverArb, semverArb, (a, b) => {
          const result = compareVersions(a, b);
          const reverseResult = compareVersions(b, a);
          
          if (result === 1) {
            expect(reverseResult).toBe(-1);
          } else if (result === -1) {
            expect(reverseResult).toBe(1);
          } else {
            expect(reverseResult).toBe(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should satisfy transitivity: if a > b and b > c, then a > c', () => {
      fc.assert(
        fc.property(semverArb, semverArb, semverArb, (a, b, c) => {
          const ab = compareVersions(a, b);
          const bc = compareVersions(b, c);
          const ac = compareVersions(a, c);
          
          // If a > b and b > c, then a > c
          if (ab === 1 && bc === 1) {
            expect(ac).toBe(1);
          }
          
          // If a < b and b < c, then a < c
          if (ab === -1 && bc === -1) {
            expect(ac).toBe(-1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle versions with missing patch correctly', () => {
      fc.assert(
        fc.property(partialVersionArb, (version) => {
          const parsed = parseVersion(version);
          expect(parsed.major).toBeGreaterThanOrEqual(0);
          expect(parsed.minor).toBeGreaterThanOrEqual(0);
          expect(parsed.patch).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle versions with v prefix correctly', () => {
      fc.assert(
        fc.property(versionWithPrefixArb, (version) => {
          const withoutPrefix = version.replace(/^v/, '');
          expect(compareVersions(version, withoutPrefix)).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly order major version differences', () => {
      fc.assert(
        fc.property(
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          (major1, major2, minor, patch) => {
            fc.pre(major1 !== major2); // Precondition: majors must be different
            
            const v1 = `${major1}.${minor}.${patch}`;
            const v2 = `${major2}.${minor}.${patch}`;
            const result = compareVersions(v1, v2);
            
            if (major1 > major2) {
              expect(result).toBe(1);
            } else {
              expect(result).toBe(-1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly order minor version differences when major is equal', () => {
      fc.assert(
        fc.property(
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          (major, minor1, minor2, patch) => {
            fc.pre(minor1 !== minor2); // Precondition: minors must be different
            
            const v1 = `${major}.${minor1}.${patch}`;
            const v2 = `${major}.${minor2}.${patch}`;
            const result = compareVersions(v1, v2);
            
            if (minor1 > minor2) {
              expect(result).toBe(1);
            } else {
              expect(result).toBe(-1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly order patch version differences when major and minor are equal', () => {
      fc.assert(
        fc.property(
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          (major, minor, patch1, patch2) => {
            fc.pre(patch1 !== patch2); // Precondition: patches must be different
            
            const v1 = `${major}.${minor}.${patch1}`;
            const v2 = `${major}.${minor}.${patch2}`;
            const result = compareVersions(v1, v2);
            
            if (patch1 > patch2) {
              expect(result).toBe(1);
            } else {
              expect(result).toBe(-1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should treat prerelease versions as less than release versions', () => {
      fc.assert(
        fc.property(
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          fc.constantFrom('alpha', 'beta', 'rc.1'),
          (major, minor, patch, prerelease) => {
            const release = `${major}.${minor}.${patch}`;
            const prereleaseVersion = `${major}.${minor}.${patch}-${prerelease}`;
            
            expect(compareVersions(release, prereleaseVersion)).toBe(1);
            expect(compareVersions(prereleaseVersion, release)).toBe(-1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ignore build metadata in comparison', () => {
      fc.assert(
        fc.property(
          semverArb,
          fc.stringOf(fc.constantFrom('build', '.', '0', '1', '2'), { minLength: 1, maxLength: 10 }),
          fc.stringOf(fc.constantFrom('build', '.', '0', '1', '2'), { minLength: 1, maxLength: 10 }),
          (version, build1, build2) => {
            const v1 = `${version}+${build1}`;
            const v2 = `${version}+${build2}`;
            
            expect(compareVersions(v1, v2)).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency between comparison functions', () => {
      fc.assert(
        fc.property(semverArb, semverArb, (a, b) => {
          const cmpResult = compareVersions(a, b);
          
          expect(isVersionGreater(a, b)).toBe(cmpResult === 1);
          expect(isVersionLess(a, b)).toBe(cmpResult === -1);
          expect(isVersionEqual(a, b)).toBe(cmpResult === 0);
          expect(isVersionGreaterOrEqual(a, b)).toBe(cmpResult === 1 || cmpResult === 0);
          expect(isVersionLessOrEqual(a, b)).toBe(cmpResult === -1 || cmpResult === 0);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce correctly sorted arrays', () => {
      fc.assert(
        fc.property(fc.array(semverArb, { minLength: 2, maxLength: 10 }), (versions) => {
          const ascending = sortVersionsAscending(versions);
          const descending = sortVersionsDescending(versions);
          
          // Check ascending order
          for (let i = 0; i < ascending.length - 1; i++) {
            const cmp = compareVersions(ascending[i], ascending[i + 1]);
            expect(cmp).toBeLessThanOrEqual(0);
          }
          
          // Check descending order
          for (let i = 0; i < descending.length - 1; i++) {
            const cmp = compareVersions(descending[i], descending[i + 1]);
            expect(cmp).toBeGreaterThanOrEqual(0);
          }
          
          // Ascending and descending should be reverses of each other
          expect(ascending).toEqual([...descending].reverse());
        }),
        { numRuns: 100 }
      );
    });

    it('should parse and normalize versions consistently', () => {
      fc.assert(
        fc.property(semverArb, (version) => {
          const normalized = normalizeVersion(version);
          const parsed = parseVersion(normalized);
          
          // Normalized version should parse correctly
          expect(parsed.major).toBeGreaterThanOrEqual(0);
          expect(parsed.minor).toBeGreaterThanOrEqual(0);
          expect(parsed.patch).toBeGreaterThanOrEqual(0);
          
          // Comparing original and normalized should be equal
          expect(compareVersions(version, normalized)).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: versions with leading zeros', () => {
      fc.assert(
        fc.property(
          versionNumberArb,
          versionNumberArb,
          versionNumberArb,
          (major, minor, patch) => {
            const normal = `${major}.${minor}.${patch}`;
            const withZeros = `0${major}.0${minor}.0${patch}`;
            
            // Leading zeros should not affect comparison
            expect(compareVersions(normal, withZeros)).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
