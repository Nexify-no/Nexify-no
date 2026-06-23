/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';

describe('useUndoRedo', () => {
  it('should initialize with the provided initial state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    expect(result.current.value).toBe('initial');
  });

  it('should set a new value and clear future', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('updated');
    });

    expect(result.current.value).toBe('updated');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should undo to previous state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
      result.current.set('third');
    });

    expect(result.current.value).toBe('third');

    act(() => {
      result.current.undo();
    });

    expect(result.current.value).toBe('second');
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo to next state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
      result.current.set('third');
      result.current.undo();
    });

    expect(result.current.value).toBe('second');

    act(() => {
      result.current.redo();
    });

    expect(result.current.value).toBe('third');
  });

  it('should clear future when setting new value after undo', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
      result.current.set('third');
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.set('new');
    });

    expect(result.current.value).toBe('new');
    expect(result.current.canRedo).toBe(false);
  });

  it('should not undo when at initial state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.value).toBe('initial');
  });

  it('should not redo when at latest state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
    });

    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.redo();
    });

    expect(result.current.value).toBe('second');
  });

  it('should handle multiple undo operations', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
      result.current.set('third');
      result.current.set('fourth');
    });

    act(() => {
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.value).toBe('second');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });

  it('should handle multiple redo operations', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    
    act(() => {
      result.current.set('second');
      result.current.set('third');
      result.current.set('fourth');
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });

    act(() => {
      result.current.redo();
      result.current.redo();
    });

    expect(result.current.value).toBe('third');
  });
});