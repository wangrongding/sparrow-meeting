const path = require("path");
const CompressionPlugin = require("compression-webpack-plugin");
const resolve = (dir) => path.join(__dirname, dir);

module.exports = {
    lintOnSave: false,
    // 关闭生产环境的sourcemap
    productionSourceMap: false,
    devServer: {
        host: "0.0.0.0",
        port: 9530,
        disableHostCheck: true,
        proxy: {
            "/api": {
                target: process.env.VUE_APP_BASE_URL,
                changeOrigin: true,
                ws: false,
                pathRewrite: {
                    "^/api": "/",
                },
            },
        },
    },
    pluginOptions: {
        "less-loader":{
            preProcessor:'less',
            // patterns:[path.resolve()]
        }
    },
    // 开启gzip压缩
    configureWebpack: () => {
        if (process.env.NODE_ENV === "production") {
            return {
                plugins: [
                    new CompressionPlugin({
                        test: /\.js$|\.html$|\.css/,
                        threshold: 10240,
                        deleteOriginalAssets: false,
                    }),
                ],
            };
        }
    },
    chainWebpack: (config) => {
        config.resolve.alias
            .set("@", resolve("src"))
            .set("components", resolve("src/components"));
        config.plugin("html").tap((args) => {
            args[0].title = "多人协同";
            return args;
        });
    },
};
