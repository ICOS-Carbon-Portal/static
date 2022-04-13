const path = require('path');
const fs = require('fs');
const FileManagerPlugin = require('filemanager-webpack-plugin');

const buildFolder = path.resolve(__dirname, 'tsTarget');
const destinationFolderJs = path.resolve(__dirname, 'target');

const filesInDestinationToClean = fs.existsSync(buildFolder)
	? fs.readdirSync(buildFolder).map(file => (
		{
			source: file,
			options: { force: true }
		}))
	: [path.resolve(buildFolder, 'nonExistingFile.nada')];

module.exports = {
	entry: {
		stations: './src/main.tsx'
	},
	output: {
		path: buildFolder,
		filename: '[name].js',
		clean: true,
	},
	plugins: [
		new FileManagerPlugin({
			events: {
				onEnd: {
					delete: filesInDestinationToClean,
					copy: [
						{ source: buildFolder + '/*.js', destination: destinationFolderJs }
					],
				},
			},
			runTasksInSeries: true
		})
	],
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				loader: 'ts-loader',
				exclude: ['/node_modules/'],
			},
			{
				test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/,
				type: 'asset',
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js', '.jsx'],
	},
	stats: {
		builtAt: true,
		// errorDetails: true,
		// children: true,
	}
};
