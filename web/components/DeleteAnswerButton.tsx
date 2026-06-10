"use client";

type DeleteAnswerButtonProps = {
  confirmMessage?: string;
  label?: string;
};

export default function DeleteAnswerButton({
  confirmMessage = "Delete this saved answer?",
  label = "Delete"
}: DeleteAnswerButtonProps) {
  return (
    <button
      className="danger-button"
      onClick={(event) => {
        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {label}
    </button>
  );
}
