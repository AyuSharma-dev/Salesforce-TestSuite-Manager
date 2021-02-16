// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';
import * as vscode from 'vscode';
const { exec } = require( 'child_process' );
const fs = require('fs') 

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "salesforce-testsuite-generator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('salesforce-testsuite-generator.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInputBox
		vscode.window.showInformationMessage('Hello World from Salesforce TestSuite Generator!');
		/*let foo = exec('sfdx force:apex:test:run -s "SORG469" -r human',{
			maxBuffer: 1024 * 1024 * 6,
			cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
		});
		foo.stdout.on("data",(dataArg : any)=> {
			console.log('stdout: ' + dataArg);
		});

		foo.stderr.on("data",(data : any)=> {
			console.log('stderr: ' + data);
		});

		foo.stdin.on("data",(data : any)=> {
			console.log('stdin: ' + data);
		});
		
		foo.on('exit',(code: string,signal: any)=>{
			console.log('exit code '+code);
		});*/
		var items = [];
		let currentPanel: vscode.WebviewPanel | undefined = undefined;
		let foo = exec("sfdx force:data:soql:query -q \"Select Name From ApexClass Where Name Like '%test%'\"",{
			maxBuffer: 1024 * 1024 * 6,
			cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
		});

		foo.stdout.on("data",(dataArg : any)=> {
			try{
				items = items.concat( dataArg.split('\n') );
			}
			catch( err ){
				console.log( 'err-->'+err.message );
			}
		});

		foo.on('close', (data: any)=> {
			getFilteredData( items ).then(function ( realData ) {
				if( realData.length > 5 ){
					console.log('items-->'+realData);
					try{
						getListOfElements(realData).then(function( content ){
							currentPanel = vscode.window.createWebviewPanel(
								'catCoding',
								'Cat Coding',
								vscode.ViewColumn.One,
								{
									enableScripts: true
								}
							);
							currentPanel.webview.html = getWebviewContent(realData, content);

							currentPanel.webview.onDidReceiveMessage(
			
								message => {
									console.log('message-->'+message.command);
								  switch (message.command) {
									case 'submit':
									  vscode.window.showErrorMessage(message.text);
									  var selectedClasses = message.text.split(' ');
									  selectedClasses.pop();
									  console.log( 'selectedClasses-->'+selectedClasses );
									  console.log('path-->'+vscode.workspace.workspaceFolders[0].uri.fsPath);
									  createTestSuiteContent( selectedClasses ).then(function( fileData ){
										if (!fs.existsSync(vscode.workspace.workspaceFolders[0].uri.fsPath+'\\force-app\\main\\default\\testSuites')){
											fs.mkdirSync(vscode.workspace.workspaceFolders[0].uri.fsPath+'\\force-app\\main\\default\\testSuites');
										}
										fs.writeFile(vscode.workspace.workspaceFolders[0].uri.fsPath+'\\force-app\\main\\default\\testSuites\\SORG422.testSuite-meta.xml', fileData, (err) => { 
      
											// In case of a error throw err. 
											if (err) throw err; 
											else{
												deployTsToOrg( vscode.workspace.workspaceFolders[0].uri.fsPath+'\\force-app\\main\\default\\testSuites\\SORG422.testSuite-meta.xml' ).then(function( Code ){
													console.log( 'Code received-->'+Code );
													vscode.window.showInformationMessage('Test Suit successfully created.');
												});
											}
										}) 
									  });
								  }
								},
								undefined,
								context.subscriptions
							);
						});
						
					}
					catch( err ){
						console.log('err_->'+err.message);
					}
					
				}
			});
			
		});
	
		foo.stderr.on("data",(data : any)=> {
			console.log('stderr: ' + data);
			
		});

	});

	context.subscriptions.push(disposable);
}

function getFilteredData( items ){
	return new Promise((resolve, reject) => {
		setTimeout(() => {
		items = items.filter(function (el) {
			return (el != null && el != '');
		});
		items.pop();
		items.shift();
		items.shift();
		resolve(items);
	},200);
	});
}

function getListOfElements( items ){
	var htmlContent = '';
	return new Promise((resolve, reject) => {
		setTimeout(() => {
		for( var i=0; i<items.length; i++ ){
			htmlContent += '<input type="checkbox" id="'+items[i]+'" name="mycheckboxes" value="'+items[i]+'">';
			htmlContent += '<label for="'+items[i]+'">'+items[i]+'</label><br>';
		}
		resolve(htmlContent);
	},200);
	});
}

function createTestSuiteContent( selectedClasses ){
	var dataToReturn = '<?xml version="1.0" encoding="UTF-8"?>\n';
	dataToReturn += '<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">\n';
	return new Promise((resolve, reject) => {
		setTimeout(() => {
		for( var i=0; i<selectedClasses.length; i++ ){
			dataToReturn += '	<testClassName>'+selectedClasses[i].replaceAll('\n','')+'</testClassName>\n';
		}
		dataToReturn += '</ApexTestSuite>';
		console.log( 'dataReturn-->'+dataToReturn );
		resolve(dataToReturn);
	},500);
	});

}

function deployTsToOrg( dir ){

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			console.log('dirBefore-->'+dir);
			dir = "\""+dir+"\"";
			console.log('dirAfter-->'+dir);
			let foo = exec("sfdx force:source:deploy --json -p "+dir,{
				maxBuffer: 1024 * 1024 * 6,
				cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
			});

			foo.stdout.on("data",(dataArg : any)=> {
				console.log( 'stdout-->'+dataArg );
			});

			foo.stderr.on("data",(data : any)=> {
				console.log('stderr:Deploying ' + data);
			});

			foo.on('close', (Code: any)=> {
				console.log('code-->'+Code);
				resolve(Code);
			});
		},500);
	});

}

function getWebviewContent( items, content ) {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
  <script>
  	function myFunction() {
		var checkedBoxes = document.querySelectorAll('input[name=mycheckboxes]:checked');
		var classes = '';
		for( var i=0; i<checkedBoxes.length; i++ ){
			classes += checkedBoxes[i].id+' ';
		}
		const vscode = acquireVsCodeApi();
		vscode.postMessage({
			command: 'submit',
			text: classes
		})
	}
  </script>
  	${content}
	<br/>
	<button onclick="myFunction()">Submit</button>
  </body>
  </html>`;
}

// this method is called when your extension is deactivated
export function deactivate() {}
