# Project notes

## Commits

- Do not include `Co-Authored-By` trailers or other AI attribution in
  commit messages. Use the existing Git author configuration.

## Deployment

- Frontend is hosted on GoDaddy: build `dist/` with `npm run build`
  and upload its contents to the web root (manual, no CI/CD).
- The FastAPI/Houdini backend lives in a separate repo and runs on AWS
  EC2 (api.ornamentcreator.com).
