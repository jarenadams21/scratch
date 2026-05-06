export function confirmDelete(promptMessage, deleteFn, onSuccess) {
  return async () => {
    if (!confirm(promptMessage)) return;
    try {
      await deleteFn();
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Deletion failed: ' + err.message);
    }
  };
}
