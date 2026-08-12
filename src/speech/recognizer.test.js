import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechManager } from './recognizer.js';

let instances;
let documentListeners;

function installBrowser({ mobile = false, supported = true } = {}) {
  instances = [];
  documentListeners = new Map();
  class FakeRecognition {
    constructor() {
      instances.push(this);
      this.start = vi.fn();
      this.stop = vi.fn();
      this.abort = vi.fn();
    }
  }
  const document = {
    hidden: false,
    addEventListener: vi.fn((event, listener) => documentListeners.set(event, listener)),
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', supported ? { SpeechRecognition: FakeRecognition } : {});
  vi.stubGlobal('navigator', {
    userAgent: mobile ? 'iPhone' : 'Desktop',
    maxTouchPoints: mobile ? 1 : 0,
  });
  vi.stubGlobal('location', { search: mobile ? '?mobileqa=1' : '' });
  return document;
}

function setHidden(document, hidden) {
  document.hidden = hidden;
  documentListeners.get('visibilitychange')();
}

describe('SpeechManager lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('remains unavailable when the browser has no recognition API', () => {
    const document = installBrowser({ supported: false });
    const speech = new SpeechManager();

    expect(speech.available).toBe(false);
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it.each(['not-allowed', 'audio-capture'])('treats %s as terminal and does not retry', (error) => {
    installBrowser();
    const speech = new SpeechManager();
    const blocked = vi.fn();
    speech.on('mic-blocked', blocked);

    speech.start();
    vi.runOnlyPendingTimers();
    instances[0].onerror({ error });
    vi.advanceTimersByTime(5000);

    expect(speech.available).toBe(false);
    expect(blocked).toHaveBeenCalledWith(error);
    expect(instances[0].start).toHaveBeenCalledTimes(1);
  });

  it('retries a recoverable error once through the existing scheduled restart', () => {
    installBrowser();
    const speech = new SpeechManager();

    speech.start();
    vi.runOnlyPendingTimers();
    instances[0].onerror({ error: 'network' });
    vi.advanceTimersByTime(299);
    expect(instances[0].start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);

    expect(speech.available).toBe(true);
    expect(instances[0].start).toHaveBeenCalledTimes(2);
  });

  it('stops and restarts the same desktop recognizer after visibility returns', () => {
    const document = installBrowser();
    const speech = new SpeechManager();

    speech.start();
    vi.runOnlyPendingTimers();
    instances[0].onstart();
    setHidden(document, true);
    instances[0].onend();
    setHidden(document, false);
    vi.advanceTimersByTime(100);

    expect(instances).toHaveLength(1);
    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    expect(instances[0].abort).not.toHaveBeenCalled();
    expect(instances[0].start).toHaveBeenCalledTimes(2);
  });

  it('renews one mobile recognizer on hide and schedules only one visible restart', () => {
    const document = installBrowser({ mobile: true });
    const speech = new SpeechManager();

    speech.start({ immediate: true });
    instances[0].onstart();
    setHidden(document, true);
    setHidden(document, false);
    setHidden(document, false);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(1000);

    expect(instances).toHaveLength(2);
    expect(instances[0].abort).toHaveBeenCalledTimes(1);
    expect(instances[1].start).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function for event listeners', () => {
    installBrowser();
    const speech = new SpeechManager();
    const heard = vi.fn();
    const unsubscribe = speech.on('heard', heard);

    speech.injectUtterance('cat');
    unsubscribe();
    speech.injectUtterance('dog');

    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ text: 'cat' }));
  });
});
