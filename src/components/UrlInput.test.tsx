import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import UrlInput from "./UrlInput";

function Harness({
  onSubmit,
  initial = "",
  disabled,
}: {
  onSubmit: (videoId: string) => void;
  initial?: string;
  disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <UrlInput
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      disabled={disabled === true}
    />
  );
}

describe("UrlInput", () => {
  it("renders label and placeholder from copy table", () => {
    render(<Harness onSubmit={() => {}} />);
    expect(screen.getByLabelText("YouTube 영상 URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://www.youtube.com/watch?v=...")).toBeInTheDocument();
  });

  it("input has autocomplete off and spellcheck false", () => {
    render(<Harness onSubmit={() => {}} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });

  it("calls onSubmit with videoId when valid URL is entered then blur", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await user.tab();
    expect(onSubmit).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("calls onSubmit on Enter key", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://youtu.be/dQw4w9WgXcQ");
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("does not call onSubmit while typing (no debounce)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows no error on empty blur", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.click(input);
    await user.tab();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows invalid domain error on non-youtube host", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://example.com/watch?v=dQw4w9WgXcQ");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("YouTube URL이 아닙니다");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows invalid video error on bad videoId", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://www.youtube.com/watch?v=tooshort");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("올바른 영상 URL이 아닙니다");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows playlist error on playlist URL", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://www.youtube.com/playlist?list=PLabc");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("영상 URL만 지원합니다 (플레이리스트 불가)");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows channel error on channel URL with /@handle", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://www.youtube.com/@somehandle");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("영상 URL만 지원합니다");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears error when user types again after error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, "https://example.com/");
    await user.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(input);
    await user.type(input, "a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disabled blocks blur trigger", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        onSubmit={onSubmit}
        initial="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        disabled
      />,
    );
    const input = screen.getByLabelText("YouTube 영상 URL");
    expect(input).toBeDisabled();
    await user.click(input);
    await user.tab();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
