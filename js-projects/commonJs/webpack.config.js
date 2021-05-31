const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const buildFolder = path.resolve(__dirname, 'dist');

module.exports = {
	mode: 'development',
	entry: {
		stations: './main/stations.ts'
	},
	output: {
		path: buildFolder,
		filename: '[name].js',
		clean: true,
		library: {
			type: "window"
		}
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				loader: 'ts-loader',
				exclude: ['/node_modules/'],
			}
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js', '.jsx'],
	},
	target: ["web", "es5"],
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				test: /\.js$/i,
				parallel: true,
				terserOptions: {
					ecma: '2017',
					keep_classnames: true,
					keep_fnames: true,
				},
			}),
		],
	},
	stats: {
		builtAt: true,
		// errorDetails: true,
		// children: true,
	}
};
