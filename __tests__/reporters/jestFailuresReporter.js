const fs = require('fs');
const path = require('path');

const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/g, '');

class JestFailuresReporter {
  onRunComplete(_contexts, results) {
    const outputDir = path.join(process.cwd(), '__tests__', 'reports');
    const outputFile = path.join(outputDir, 'jest-failures.txt');

    fs.mkdirSync(outputDir, { recursive: true });

    if (results.numFailedTests === 0 && results.numFailedTestSuites === 0) {
      fs.writeFileSync(outputFile, 'All tests passed.\n');
      return;
    }

    const lines = [];
    lines.push(`Failed test suites: ${results.numFailedTestSuites}`);
    lines.push(`Failed tests: ${results.numFailedTests}`);
    lines.push('');

    results.testResults.forEach((suite) => {
      if (suite.numFailingTests === 0) return;
      lines.push(`Suite: ${suite.testFilePath}`);

      suite.testResults.forEach((test) => {
        if (test.status !== 'failed') return;
        lines.push(`  Test: ${test.fullName}`);

        if (test.failureMessages && test.failureMessages.length > 0) {
          test.failureMessages.forEach((message, index) => {
            lines.push(`  Failure ${index + 1}:`);
            lines.push(stripAnsi(message));
          });
        }

        lines.push('');
      });

      lines.push('');
    });

    fs.writeFileSync(outputFile, lines.join('\n'));
  }
}

module.exports = JestFailuresReporter;
