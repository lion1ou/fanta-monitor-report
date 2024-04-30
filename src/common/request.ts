export const ajaxGet = async (url: string) => {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 304)) {
        resolve({
          data: JSON.parse(xhr.responseText),
          status: xhr.status,
        });
      }
    };
    xhr.onerror = function (e) {
      reject(e);
    }
    xhr.send();
  })
}
