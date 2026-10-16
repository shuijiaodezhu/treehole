package cn.yourletters.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * 你的来信 · 安卓壳
 *
 * 用系统自带的 WebView（每台安卓都有 ✓ 不依赖 Chrome ✗）
 * 三件必要的事：
 *   ① 头像上传 → 实现 onShowFileChooser（不然选图会没反应 ✗）
 *   ② 返回键 → 能回上一页就回页，回不了才退出 App ✓
 *   ③ 站外链接（比如邮件里的确认链接）→ 交给系统浏览器 ✓ 别困在壳子里 ✗
 */
class MainActivity : AppCompatActivity() {

    private var web: WebView? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val wv = WebView(this)
        setContentView(wv)
        web = wv

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                 // localStorage：登录状态要用 ✓
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false // 音乐/语音能直接播 ✓
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        wv.webChromeClient = object : WebChromeClient() {
            // 头像/图片上传：把系统文件选择器接上 ✓
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(params!!.createIntent(), REQ_FILE)
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val url = request?.url ?: return false
                val host = url.host ?: return false
                // 站内自己走；站外交给系统浏览器 ✓
                if (host.endsWith("yourletters.cn")) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        if (savedInstanceState == null) {
            wv.loadUrl(START_URL)
        } else {
            wv.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    @Deprecated("文件选择器用老接口最省事，且不需要额外依赖")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            val cb = fileCallback
            fileCallback = null
            if (cb == null) return
            val uris: Array<Uri>? = try {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } catch (e: Exception) {
                null
            }
            cb.onReceiveValue(uris)
            return
        }
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onBackPressed() {
        val wv = web
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    companion object {
        private const val START_URL = "https://yourletters.cn"
        private const val REQ_FILE = 1001
    }
}
