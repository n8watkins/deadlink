# Deploying the Relink landing page

The landing page is live at https://relink.n8builds.dev.
It is a fully static Next.js export (`output: "export"`) served by Cloudflare Workers static assets, with no Worker script and no server routes.
The Worker is `relink-landing` in the owner's Cloudflare account, and `wrangler.jsonc` attaches `relink.n8builds.dev` as a Workers custom domain, so Cloudflare creates and manages the DNS record itself.
Security and cache headers live in `public/_headers`.

## Redeploy

Log in once with `npx wrangler login` (check with `npx wrangler whoami`).
From `landing/`, run `npm run lint && npm run typecheck`, then `npm run deploy`.
`npm run deploy` runs `next build` (writes `out/`) and then `wrangler deploy`, which uploads only changed assets.
To check the build locally first, run `npm run build && npm run preview` and open http://localhost:8787.

## Roll back

Run `npx wrangler deployments list` to see recent deployments, or `npx wrangler versions list` to see versions.
Run `npx wrangler rollback` to return to the previous version, or `npx wrangler rollback <version-id>` for a specific one.
Static assets are versioned with the Worker, so a rollback restores the old pages too.
Fix forward afterwards by reverting the commit and running `npm run deploy` again, so the repository matches what is live.

## Moving to its own domain later

Add the new hostname to `routes` in `wrangler.jsonc`, set the default URL in `lib/site.ts`, and deploy.
Keep `relink.n8builds.dev` in `routes` for a while and redirect it once the new domain is live.

## Taking it down

Run `npx wrangler delete relink-landing`, which also removes the custom domain and its DNS record.
