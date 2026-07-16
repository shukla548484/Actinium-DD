# Debug Session: mobile-apk-build
- **Status**: [OPEN]
- **Issue**: `npm run mobile:apk:debug` fails instead of producing a debug APK.
- **Debug Server**: N/A for command-line build failure
- **Log File**: Terminal output from `npm run mobile:apk:debug`

## Reproduction Steps
1. Open a shell in the project root.
2. Run `npm run mobile:apk:debug`.
3. Observe the failure output before APK generation completes.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Android SDK path is missing for Gradle in this shell | High | Low | Rejected: `local.properties` is present |
| B | `mobile/android/local.properties` is missing or points to the wrong path | High | Low | Confirmed: path exists in file but directory is missing on disk |
| C | The wrapper script is not surfacing the real Gradle failure clearly enough | Medium | Low | Confirmed: Gradle reported the missing directory after startup |
| D | Java/Gradle environment differs from the shell used for earlier checks | Medium | Medium | Inconclusive |

## Log Evidence
- `mobile/android/local.properties` contains `sdk.dir=/Users/akhileshshukla/Library/Android/sdk`
- Build output reports: `sdk.dir property in local.properties file. Problem: Directory does not exist`
- Gradle then fails with `SDK location not found`

## Verification Conclusion
Root cause confirmed: the configured Android SDK path does not exist on this machine. Secondary usability issue confirmed: the wrapper script allowed Gradle to start before surfacing the path problem clearly.
