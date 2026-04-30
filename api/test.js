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
  // 末尾に /.default を必ずつける
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
  TENANT_ID_env_value: process.env.AZURE_TENANT_ID, // 生の値を出力
  CLIENT_ID_env_value: process.env.AZURE_CLIENT_ID, // 生の値を出力
  KEYVAULT_UR_env_value: process.env.AZURE_KEYVAULT_URL, // 生の値を出力
  VERCEL_OIDC_TOKEN_env_value: process.env.VERCEL_OIDC_TOKEN, // 生の値を出力
  status: "Success",
  message: "環境変数の読み込みチェック",
  // 各変数が「読み込めているか」を判定
  envChecks: {
    hasKeyVaultUrl: !!process.env.AZURE_KEYVAULT_URL,
    hasTenantId: !!process.env.AZURE_TENANT_ID,
    hasClientId: !!process.env.AZURE_CLIENT_ID,
    // 文字数だけ出力して、正しい値っぽいか確認（例: IDなら36文字）
    clientIdLength: process.env.AZURE_CLIENT_ID?.length || 0
  },
  // 既存のAzure接続デバッグも継続
  azureStatusCode: kvResponse.status,
  rawResponse: JSON.stringify(kvData)
});
  } catch (error) {
    res.status(500).json({ status: "Error", details: error.message });
  }
}
