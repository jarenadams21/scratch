const NUMBERS = Object.freeze({
  get_sources: 27,
  create_source: 28,
  update_source: 29,
  delete_source: 30,
  request_source_upload_url: 31,
});

function message(command, content = {}) {
  return {
    command,
    payload: { content, num: NUMBERS[command] },
  };
}

export const getSourcesMessage = () => message('get_sources');
export const createSourceMessage = source => message('create_source', source);
export const updateSourceMessage = (id, patch) => message('update_source', { id, patch });
export const deleteSourceMessage = id => message('delete_source', { id });
export const requestSourceUploadUrlMessage = (filename, contentType, fileSize) =>
  message('request_source_upload_url', { filename, contentType, fileSize });
