export const ExcalidrawPlusPromoBanner = ({
  onSelect,
  isActive,
}: {
  onSelect: () => void;
  isActive: boolean;
}) => {
  return (
    <button
      type="button"
      className={`plus-banner plus-banner--solid${isActive ? " active" : ""}`}
      onClick={onSelect}
      aria-pressed={isActive}
    >
      Drawsy AI
    </button>
  );
};
