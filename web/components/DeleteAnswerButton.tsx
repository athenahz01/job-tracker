"use client";

type DeleteAnswerButtonProps = {
  label?: string;
};

export default function DeleteAnswerButton({ label = "Delete" }: DeleteAnswerButtonProps) {
  return (
    <button
      className="danger-button"
      onClick={(event) => {
        const confirmed = window.confirm("Delete this saved answer?");
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
