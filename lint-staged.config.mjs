export default {
  'frontend/src/**/*.ts': (filenames) => {
    const relative = filenames.map((f) => f.replace(/^.*\/frontend\//, ''));
    return `cd frontend && npx eslint ${relative.join(' ')}`;
  },
  'frontend/src/**/*.html': (filenames) => {
    const relative = filenames.map((f) => f.replace(/^.*\/frontend\//, ''));
    return `cd frontend && npx eslint ${relative.join(' ')}`;
  },
};
