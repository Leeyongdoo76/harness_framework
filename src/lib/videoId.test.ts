import { describe, expect, it } from "vitest";
import { parseVideoId } from "./videoId";

describe("parseVideoId", () => {
  describe("accepts", () => {
    it("https watch?v=", () => {
      expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("http watch?v=", () => {
      expect(parseVideoId("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtube.com without www", () => {
      expect(parseVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("m.youtube.com watch", () => {
      expect(parseVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtu.be short URL", () => {
      expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtube.com/shorts/", () => {
      expect(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtube.com/embed/", () => {
      expect(parseVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtube.com/v/", () => {
      expect(parseVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("youtube.com/live/", () => {
      expect(parseVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("ignores extra t param", () => {
      expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    });

    it("ignores extra list param on watch", () => {
      expect(
        parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc"),
      ).toBe("dQw4w9WgXcQ");
    });

    it("ignores si param", () => {
      expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc123")).toBe("dQw4w9WgXcQ");
    });

    it("trims surrounding whitespace", () => {
      expect(parseVideoId("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
    });
  });

  describe("rejects", () => {
    it("empty string", () => {
      expect(parseVideoId("")).toBeNull();
    });

    it("only whitespace", () => {
      expect(parseVideoId("   ")).toBeNull();
    });

    it("longer than 2000 chars", () => {
      expect(parseVideoId("https://youtu.be/" + "a".repeat(2000))).toBeNull();
    });

    it("non-URL string", () => {
      expect(parseVideoId("not a url")).toBeNull();
    });

    it("non-youtube domain", () => {
      expect(parseVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    });

    it("playlist URL", () => {
      expect(parseVideoId("https://www.youtube.com/playlist?list=PLabc")).toBeNull();
    });

    it("channel URL with /channel/", () => {
      expect(parseVideoId("https://www.youtube.com/channel/UC123")).toBeNull();
    });

    it("channel URL with /@handle", () => {
      expect(parseVideoId("https://www.youtube.com/@somehandle")).toBeNull();
    });

    it("channel URL with /user/", () => {
      expect(parseVideoId("https://www.youtube.com/user/somename")).toBeNull();
    });

    it("channel URL with /c/", () => {
      expect(parseVideoId("https://www.youtube.com/c/somename")).toBeNull();
    });

    it("invalid videoId (10 chars)", () => {
      expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXc")).toBeNull();
    });

    it("invalid videoId (12 chars)", () => {
      expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQX")).toBeNull();
    });

    it("watch without v param", () => {
      expect(parseVideoId("https://www.youtube.com/watch")).toBeNull();
    });

    it("ftp scheme", () => {
      expect(parseVideoId("ftp://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    });
  });
});
