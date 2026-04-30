// api/hello.js
export default async function handler(req, res) {
  // 環境変数の取得
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const vaultUrl = process.env.AZURE_KEYVAULT_URL;

  /**
   * 【重要】Vercel OIDCトークンの取得
   * process.env.VERCEL_OIDC_TOKEN ではなく、
   * リクエストヘッダーの 'x-vercel-oidc-token' から取得します。
   */
  const vercelOidcToken = req.headers['x-vercel-oidc-token'];

  try {
    // 1. トークンが存在するかチェック（デバッグ用）
    if (!vercelOidcToken) {
      return res.status(401).json({
        status: "Error",
        message: "Vercel OIDC Token がヘッダーに見つかりません。VercelのProject SettingsでOIDCが有効になっているか、デプロイ済みの環境か確認してください。",
        envChecks: {
          hasTenantId: !!tenantId,
          hasClientId: !!clientId,
          hasVaultUrl: !!vaultUrl
        }
      });
    }

    // 2. Azureアクセストークンへの交換 (Client Assertion を使用)
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: vercelOidcToken, // Vercel発行のトークンをここにセット
        scope: 'https://vault.azure.net/.default'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(tokenResponse.status).json({
        status: "Error at Azure Auth",
        message: "Azureへのトークン交換に失敗しました。",
        azureError: tokenData
      });
    }

    const azureAccessToken = tokenData.access_token;

    // 3. Azure Key Vaultからシークレットを取得
    // ※シークレット名 'avant-csc-claude-api-key' は適宜変更してください
    const secretName = "avant-csc-claude-api-key";
    const kvResponse = await fetch(`${vaultUrl}/secrets/${secretName}?api-version=7.4`, {
      headers: { 'Authorization': `Bearer ${azureAccessToken}` }
    });

    const kvData = await kvResponse.json();

    // 4. 全ての結果を返却
    res.status(200).json({
      status: "Success",
      message: "認証およびシークレットの取得に成功しました。",
      debug: {
        env: {
          AZURE_TENANT_ID: tenantId,
          AZURE_CLIENT_ID: clientId,
          AZURE_KEYVAULT_URL: vaultUrl,
          VERCEL_OIDC_TOKEN_found: !!vercelOidcToken,
          // トークンの冒頭数文字だけ表示（デバッグ用）
          VERCEL_OIDC_TOKEN_prefix: vercelOidcToken ? `${vercelOidcToken.substring(0, 10)}...` : "none"
        },
        azureAuthStatus: tokenResponse.status,
        keyVaultStatus: kvResponse.status
      },
      // Key Vaultから取得したデータ本体
      secretData: kvData 
    });

  } catch (error) {
    // 予期せぬエラーのハンドリング
    res.status(500).json({
      status: "Error",
      message: "内部サーバーエラーが発生しました。",
      details: error.message
    });
  }
}
