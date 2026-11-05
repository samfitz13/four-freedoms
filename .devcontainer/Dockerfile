FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

ENV COREPACK_HOME=/usr/local/share/corepack
ENV PATH="/usr/local/bin:${PATH}"

RUN corepack enable --install-directory /usr/local/bin && corepack prepare pnpm@9.15.9 --activate \
    && mkdir -p /workspaces/four-freedoms/node_modules \
    && chown -R node:node /workspaces /usr/local/share/corepack
