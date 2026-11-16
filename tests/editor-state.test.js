import test from 'node:test';
import assert from 'node:assert/strict';

import { createEditorState, reduceEditorState } from '../src/ui/net-editor.js';

test('cambiar de herramienta limpia una conexión incompleta', () => {
  let state = createEditorState();
  state = reduceEditorState(state, { type: 'set-tool', tool: 'connect' });
  state = reduceEditorState(state, { type: 'node-click', id: 'p1' });
  assert.equal(state.connectingFrom, 'p1');
  state = reduceEditorState(state, { type: 'set-tool', tool: 'select' });
  assert.equal(state.connectingFrom, null);
});

test('seleccionar un nodo conserva su id para el inspector', () => {
  const state = reduceEditorState(createEditorState(), { type: 'node-click', id: 't2' });
  assert.equal(state.selectedId, 't2');
  assert.equal(state.pendingConnection, null);
});

test('la herramienta conectar produce un par después de dos clics', () => {
  let state = reduceEditorState(createEditorState(), { type: 'set-tool', tool: 'connect' });
  state = reduceEditorState(state, { type: 'node-click', id: 'p1' });
  state = reduceEditorState(state, { type: 'node-click', id: 't1' });
  assert.deepEqual(state.pendingConnection, ['p1', 't1']);
  assert.equal(state.connectingFrom, null);
});

test('consumir una conexión pendiente evita repetir el mismo arco', () => {
  const state = reduceEditorState({
    ...createEditorState(), tool: 'connect', pendingConnection: ['p1', 't1'],
  }, { type: 'connection-consumed' });
  assert.equal(state.pendingConnection, null);
});
