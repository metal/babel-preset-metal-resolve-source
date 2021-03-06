'use strict';

var assert = require('assert');
var babel = require('babel-core');
var fs = require('fs');
var path = require('path');
var rewire = require('rewire');
var sinon = require('sinon');

var preset = rewire('../index');
var rewireRevert;

module.exports = {
  setUp: function(done) {
    sinon.stub(console, 'warn');
    rewireRevert = preset.__set__('resolve', function(file) {
      if (file === 'fromMain') {
        return path.resolve('node_modules', 'fromMain/lib/index.js');
      } else if (file === 'fromMain/package.json' || file === 'unknown') {
        throw new Error();
      } else if (file === 'bar') {
        return path.resolve('node_modules', 'bar/lib/index.js');
      } else if (file === 'bar/package.json') {
        return path.resolve('test/fixtures/mockPackage.json');
      } else {
        return path.resolve('node_modules', file);
      }
    });
    done();
  },

  tearDown: function(done) {
    console.warn.restore();
    rewireRevert();
    done();
  },

  testNpmImport: function(test) {
    var code = 'import foo from "bar/lib/foo";';
    var result = babel.transform(code, {presets: [preset], filename: path.resolve('src/x/y/z/foo.js')});

    assert.notStrictEqual(-1, result.code.indexOf('../../../../node_modules/bar/lib/foo'));
    assert.strictEqual('../../../../node_modules/bar/lib/foo', result.metadata.modules.imports[0].source);
    test.done();
  },

  testNpmImportFromMain: function(test) {
    var code = 'import fromMain from "fromMain";';
    var result = babel.transform(code, {presets: [preset], filename: path.resolve('src/x/y/z/foo.js')});

    assert.notStrictEqual(-1, result.code.indexOf('../../../../node_modules/fromMain/lib/index'));
    assert.strictEqual('../../../../node_modules/fromMain/lib/index', result.metadata.modules.imports[0].source);
    test.done();
  },

  testNpmImportFromJSNextMain: function(test) {
    sinon.stub(fs, 'existsSync').returns(true);

    var code = 'import bar from "bar";';
    var result = babel.transform(code, {presets: [preset], filename: path.resolve('src/x/y/z/foo.js')});
    fs.existsSync.restore();

    assert.notStrictEqual(-1, result.code.indexOf('../../../../node_modules/bar/src/index'));
    assert.strictEqual('../../../../node_modules/bar/src/index', result.metadata.modules.imports[0].source);
    test.done();
  },

  testNpmUnknownImport: function(test) {
    var code = 'import foo from "unknown";';
    var result = babel.transform(code, {presets: [preset], filename: path.resolve('src/x/y/z/foo.js')});

    assert.notStrictEqual(-1, result.code.indexOf('unknown'));
    assert.strictEqual('../../../../unknown', result.metadata.modules.imports[0].source);
    assert.strictEqual(1, console.warn.callCount);
    test.done();
  },

  testNpmImportMissingSourceFilename: function(test) {
    var code = 'import foo from "bar/lib/foo";';
    var result = babel.transform(code, {presets: [preset]});

    assert.strictEqual(1, console.warn.callCount);
    assert.notStrictEqual(-1, result.code.indexOf(path.resolve('node_modules', '/bar/lib/foo')));
    assert.strictEqual(path.resolve('node_modules', 'bar/lib/foo'), result.metadata.modules.imports[0].source);

    test.done();
  },

  testNpmImportFromFile: function(test) {
    var result = babel.transformFileSync(__dirname + '/fixtures/npm-import.js', {presets: [preset]});

    assert.notStrictEqual(-1, result.code.indexOf('../../node_modules/bar/lib/foo'));
    assert.strictEqual('../../node_modules/bar/lib/foo', result.metadata.modules.imports[0].source);
    test.done();
  },

  testNotNpmRelativeImport: function(test) {
    var code = 'import foo from "../src/foo";';
    var result = babel.transform(code, {presets: [preset]});

    assert.notStrictEqual(-1, result.code.indexOf('../src/foo'));
    assert.strictEqual('../src/foo', result.metadata.modules.imports[0].source);
    test.done();
  },

  testNotNpmPrefixImport: function(test) {
    var code = 'import foo from "bower:bar/src/foo";';
    var result = babel.transform(code, {presets: [preset]});

    assert.notStrictEqual(-1, result.code.indexOf('bower:bar/src/foo'));
    assert.strictEqual('bower:bar/src/foo', result.metadata.modules.imports[0].source);
    test.done();
  }
};
