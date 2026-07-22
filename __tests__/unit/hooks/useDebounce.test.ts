import { act, renderHook } from '@testing-library/react-native';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 300 });

    // Value should still be initial before delay
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now it should be updated
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timeout when value changes rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    // Rapid updates
    rerender({ value: 'second' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'third' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'fourth' });

    // Should still be 'first' as no timeout completed
    expect(result.current).toBe('first');

    // Complete the final timeout
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should skip to 'fourth', not go through intermediate values
    expect(result.current).toBe('fourth');
  });

  it('should use default delay of 300ms when not specified', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Value should not change before 300ms
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Value should change at 300ms
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('should work with different types', () => {
    // Number type
    const { result: numberResult, rerender: rerenderNumber } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } }
    );

    rerenderNumber({ value: 42 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(numberResult.current).toBe(42);

    // Object type
    const initialObj = { name: 'test' };
    const updatedObj = { name: 'updated' };
    const { result: objectResult, rerender: rerenderObject } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: initialObj } }
    );

    rerenderObject({ value: updatedObj });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(objectResult.current).toEqual(updatedObj);

    // Array type
    const { result: arrayResult, rerender: rerenderArray } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: [1, 2, 3] } }
    );

    rerenderArray({ value: [4, 5, 6] });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(arrayResult.current).toEqual([4, 5, 6]);
  });

  it('should handle boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: false } }
    );

    expect(result.current).toBe(false);

    rerender({ value: true });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
  });

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: null as string | null } }
    );

    expect(result.current).toBe(null);

    rerender({ value: 'not null' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('not null');

    rerender({ value: null });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(null);
  });

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    unmount();

    // Verify cleanup was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    // Update value with longer delay
    rerender({ value: 'updated', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(100);
    });
    // Should still be initial because delay is now 500ms
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('updated');
  });
});
