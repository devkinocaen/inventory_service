export function showProgressBar(progressBar) {
  if (!progressBar) return;
  progressBar.style.display = 'block';
  progressBar.style.backgroundColor = 'black';
  progressBar.value = 0;
  progressBar.removeAttribute('hidden');
}

export function updateProgressBar(progressBar, percentage) {
  if (!progressBar) return;
  progressBar.value = percentage;
}

export function hideProgressBar(progressBar) {
  if (!progressBar) return;
  progressBar.style.display = 'none';
  progressBar.setAttribute('hidden', true);
}
