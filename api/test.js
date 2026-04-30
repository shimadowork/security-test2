// api/hello.js
export default async function handler(req, res) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const vaultUrl = process.env.AZURE_KEYVAULT_URL;
  const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN;

  try {
    // 1. Azureアクセストークンへの交換
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: vercelOidcToken,
        scope: 'https://vault.azure.net/.default'
      })
    });

    const tokenData = await tokenResponse.json();
    const azureAccessToken = tokenData.access_token;

    // 2. Key Vaultからシークレット取得
    const kvResponse = await fetch(`${vaultUrl}/secrets/avant-csc-claude-api-key?api-version=7.4`, {
      headers: { 'Authorization': `Bearer ${azureAccessToken}` }
    });

    const kvData = await kvResponse.json();

    // 3. 結果をフロントエンドに返す
res.status(200).json({ 
  status: "Success",
  message: "デバッグ実行中",
  // 取得した生データをそのまま文字列にして出力させる
  rawResponse: JSON.stringify(kvData) || "kvDataは空です", 
  // HTTPステータスコードも確認
  azureStatusCode: kvResponse.status 
});
  } catch (error) {
    res.status(500).json({ status: "Error", details: error.message });
  }
}
