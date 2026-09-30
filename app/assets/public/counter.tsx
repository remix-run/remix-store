import { clientEntry, css, on, type Handle } from "remix/ui";

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number }>) {
    let count = handle.props.initialCount;

    return () => (
      <button
        type="button"
        mix={[
          counterStyle,
          on("click", () => {
            count++;
            handle.update();
          }),
        ]}
      >
        Hydration check: {count}
      </button>
    );
  },
);

const counterStyle = css({
  background: "#fff",
  border: 0,
  borderRadius: "999px",
  color: "#000",
  cursor: "pointer",
  font: "inherit",
  padding: "0.75rem 1rem",
});
