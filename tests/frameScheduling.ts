import frameScheduling, { P_HIGH, P_LOW, P_NORMAL } from "../src/frameScheduling";

const mockDataNow = () => {
  let result = 1000;
  let count = 0;

  Date.now = () => {
    if (count === 3) {
      result = 1000;
      count = 0;
    }

    if (count === 0) {
      count++;
      return result;
    }

    count++;
    return (result += 10);
  };
};

describe("frameScheduling", () => {
  const originDateNow = Date.now.bind(Date);
  const originConsoleError = console.error;

  beforeEach(() => {
    (setImmediate as any).mockClear();
    (setTimeout as any).mockClear();
  });

  afterEach(() => {
    Date.now = originDateNow;
    console.error = originConsoleError;
  });

  it("Run multi tasks in 1 frame", () => {
    let counter = 0;

    frameScheduling(() => {
      counter++;
    });
    frameScheduling(() => {
      counter++;
    });
    frameScheduling(() => {
      counter++;
    });
    jest.runOnlyPendingTimers();

    expect(setImmediate).toHaveBeenCalledTimes(1);
    expect(counter).toBe(3);
  });

  it("Run multi tasks in multi frames", () => {
    let counter = 0;
    mockDataNow();

    frameScheduling(() => {
      counter++;
    });
    frameScheduling(() => {
      counter++;
    });
    frameScheduling(() => {
      counter++;
    });
    frameScheduling(() => {
      counter++;
    });

    jest.runAllTimers();

    expect(setImmediate).toHaveBeenCalledTimes(4);
    expect(counter).toBe(4);
  });

  it("Simple priority", () => {
    const result: string[] = [];

    frameScheduling(
      () => {
        result.push("Vue");
      },
      { priority: P_LOW },
    );
    frameScheduling(() => {
      result.push("Angular");
    });
    frameScheduling(
      () => {
        result.push("Ember");
      },
      { priority: P_LOW },
    );
    frameScheduling(
      () => {
        result.push("React");
      },
      { priority: P_HIGH },
    );

    jest.runOnlyPendingTimers();

    expect(setImmediate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["React", "Angular", "Vue", "Ember"]);
  });

  it("Priority with upfiling iterations", () => {
    const result: string[] = [];
    mockDataNow();

    frameScheduling(() => result.push("Bye"), { priority: 0 });
    frameScheduling(() => result.push("A"), { priority: 1 });
    jest.runOnlyPendingTimers();
    frameScheduling(() => result.push("Al"), { priority: 2 });
    jest.runOnlyPendingTimers();

    frameScheduling(() => result.push("Alo"), { priority: 2 });
    jest.runOnlyPendingTimers();

    jest.runOnlyPendingTimers();
    expect(result).toEqual(["A", "Al", "Bye", "Alo"]);
  });

  it("Priority with many runs", () => {
    let result = 0;
    mockDataNow();

    frameScheduling(() => (result *= 2), { priority: 0 });
    frameScheduling(() => (result *= 3), { priority: 49 });

    for (let i = 0; i < 100; i++) {
      frameScheduling(() => (result += 1), { priority: 90 });
      jest.runOnlyPendingTimers();
    }

    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(result).toEqual(354);
  });

  it("Many runs with different priority", () => {
    let result = 0;

    frameScheduling(() => (result *= 2), { priority: 0 });
    frameScheduling(() => (result *= 3), { priority: 49 });

    for (let i = 0; i < 100; i++) {
      frameScheduling(() => (result += 1), { priority: i });
    }

    jest.runOnlyPendingTimers();
    expect(result).toEqual(399);
  });

  it("Catching errors", () => {
    let result = 0;

    console.error = jest.fn();

    frameScheduling(() => (result += 2));
    frameScheduling(() => {
      throw new Error("Error async");
    });
    frameScheduling(() => (result += 3));

    jest.runAllTimers();

    expect(result).toEqual(5);
    expect(setImmediate).toHaveBeenCalledTimes(1);
  });

  it("Run different defer modes", () => {
    jest.resetModules();

    const originWindow = (global as any).window;

    delete (global as any).window;
    (global as any).requestAnimationFrame = (fn: () => {}) => setTimeout(fn, 0);

    const scheduling = require("../src/frameScheduling").default;

    let result = 0;

    scheduling(() => (result += 2));
    jest.runAllTimers();

    delete (global as any).requestAnimationFrame;
    (global as any).window = originWindow;

    expect(result).toBe(2);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });

  it("Using setTimeoutFallback", () => {
      jest.resetModules();

      const originSetImmediate = global.setImmediate;

      delete global.setImmediate;

      const scheduling = require("../src/frameScheduling").default;

      let result = 0;

      scheduling(() => (result += 3));
      jest.runAllTimers();

      global.setImmediate = originSetImmediate;

      expect(result).toBe(3);
      expect(setTimeout).toHaveBeenCalledTimes(1);
  });

  it("stops correctly with different priority nested calls", () => {
    const fn = jest.fn();

    frameScheduling(() => {
      frameScheduling(fn, { priority: P_NORMAL });
    }, { priority: P_HIGH });
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(fn).toBeCalled();
  });
});
