# Account deletion consumer

`POST /internal/v1/account-deletions` is the Kuvert target of Schlussel's
durable account deletion saga. It accepts only short-lived RS256 tokens from
the configured issuer with the exact `hof-deletion:kuvert` audience,
`token_use=deletion`, `account:delete` scope, and matching `sub`, `job_id`,
`jti`, body `userId`, and body `jobId` values.

The first delivery records an immutable job receipt and permanent user
tombstone, removes the user's financial rows and pending notification outbox
rows, then deletes the local user in one transaction. Exact replay is a
successful no-op; reused job or subject identities conflict. Tombstones are
never removed and prevent valid access tokens from recreating deleted users.
