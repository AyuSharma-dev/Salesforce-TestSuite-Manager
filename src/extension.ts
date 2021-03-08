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

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('salesforce-testsuite-generator.createtestsuite', async() => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		let tsInput = await vscode.window.showInputBox({ placeHolder: 'Enter desired name.' });
		
		if( tsInput ){
			
			console.log( 'tsInput-->'+JSON.stringify( tsInput ) );
			var testSuiteName = tsInput;
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

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Getting Test classes.",
				cancellable: false
				}, () => {
				var p = new Promise(resolve => {
					foo.on('close', (data: any)=> {
						resolve( true );
					});
				});
				return p;
			});

			var dirPath = vscode.workspace.workspaceFolders[0].uri.fsPath+'\\force-app\\main\\default\\testSuites';
			var fullPath = '';
			foo.on('close', (data: any)=> {
				getFilteredData( items ).then(function ( realData ) {
					if( realData.length > 5 ){
						console.log('items-->'+realData);
						try{
							getListOfElements(realData).then(function( content ){
								currentPanel = vscode.window.createWebviewPanel(
									'classselector',
									'TSM: Class Selector',
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
										vscode.window.withProgress({
											location: vscode.ProgressLocation.Notification,
											title: "Creating and Deploying your Test Suite.",
											cancellable: false
											}, () => {
												vscode.commands.executeCommand('workbench.action.closeActiveEditor');
											var p = new Promise(resolve => {
												var selectedClasses = message.text.split(' ');
												selectedClasses.pop();
												console.log( 'selectedClasses-->'+selectedClasses );
												console.log('path-->'+vscode.workspace.workspaceFolders[0].uri.fsPath);
												createTestSuiteContent( selectedClasses ).then(function( fileData ){
													if (!fs.existsSync(dirPath)){
														fs.mkdirSync(dirPath);
													}
													fullPath = dirPath+'\\'+testSuiteName+'.testSuite-meta.xml';
													fs.writeFile(fullPath, fileData, (err) => { 
				
														// In case of a error throw err. 
														if (err) throw err; 
														else{
															deployTsToOrg( fullPath ).then(async function( Code ){
																console.log( 'Code received-->'+Code );
																if( Code == 0 ){
																	resolve( true );
																}
																else{
																	vscode.window.showErrorMessage('Error Occurred when Creating Test Suite.');
																}
																resolve( false );
															});
														}
													}) 
												});
											});
											return p;
										}).then( async function( code ) {
											if( code ){
												var choice = await vscode.window.showInformationMessage("Test Suite successfully created. Do you want to Run it?", "Yes", "Not now");
												if (choice === "Yes") {
													vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														title: "Running Test Suite.",
														cancellable: false
														}, () => {
														var p = new Promise(resolve => {
															runTestSuit( testSuiteName ).then( function( returnValues ) {
																if( returnValues[0] == 0 ){
																	vscode.window.showInformationMessage("Test Suite Ran successfully.");
																}
																else{
																	vscode.window.showErrorMessage('Error Occurred when running Test Suite.');
																}
																const outputChannel = vscode.window.createOutputChannel('Test Suite Manager');
																outputChannel.append( returnValues[1] );
																outputChannel.show();	
																return resolve(true);
															} );
														})
														return p;
													});
												}
											}
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
		}
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
			htmlContent += '<label class="container" for="'+items[i]+'">'+items[i]+'<input id="'+items[i]+'" value="'+items[i]+'" name="mycheckboxes" type="checkbox"> <span class="checkmark"></span></label>';
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

function runTestSuit(dir) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			var outPutRes = '';
			dir = "\""+dir+"\"";
			console.log('command to run-->'+"sfdx force:apex:test:run -s "+dir+" -c -r human");
			let foo = exec("sfdx force:apex:test:run -s "+dir+" -c -r human",{
				maxBuffer: 1024 * 1024 * 6,
				cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
			});

			foo.stdout.on("data",(dataArg : any)=> {
				console.log( 'stdout-->'+dataArg );
				outPutRes += dataArg;
			});

			foo.stderr.on("data",(data : any)=> {
				console.log('stderr:Deploying ' + data);
			});

			foo.on('close', (Code: any)=> {
				console.log('code-->'+Code);
				resolve([Code,outPutRes]);
			});
		},500);
	});
}

function getWebviewContent( items, content ) {
	return `<!DOCTYPE html>
  	<html lang="en">
	<style>
	.container {
		display: block;
		position: relative;
		padding-left: 35px;
		margin-bottom: 12px;
		cursor: pointer;
		font-size: 16px;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	  }
	  
	  /* Hide the browser's default checkbox */
	  .container input {
		position: absolute;
		opacity: 0;
		cursor: pointer;
		height: 0;
		width: 0;
	  }
	  
	  /* Create a custom checkbox */
	  .checkmark {
		position: absolute;
		top: 0;
		left: 0;
		height: 15px;
		width: 15px;
		background-color: #eee;
	  }
	  
	  /* On mouse-over, add a grey background color */
	  .container:hover input ~ .checkmark {
		background-color: #ccc;
	  }
	  
	  /* When the checkbox is checked, add a blue background */
	  .container input:checked ~ .checkmark {
		background-color: #2196F3;
	  }
	  
	  /* Create the checkmark/indicator (hidden when not checked) */
	  .checkmark:after {
		content: "";
		position: absolute;
		display: none;
	  }
	  
	  /* Show the checkmark when checked */
	  .container input:checked ~ .checkmark:after {
		display: block;
	  }
	  
	  /* Style the checkmark/indicator */
	  .container .checkmark:after {
		left: 4px;
		top: 1px;
		width: 3px;
		height: 8px;
		border: solid white;
		border-width: 0 3px 3px 0;
		-webkit-transform: rotate(45deg);
		-ms-transform: rotate(45deg);
		transform: rotate(45deg);
	  }
	  .button {
		background-color: #4CAF50; /* Green */
		border: none;
		color: white;
		padding: 10px 24px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 16px;
		margin: 4px 2px;
		transition-duration: 0.4s;
		cursor: pointer;
	  }
	  .button2 {
		background-color: white; 
		color: black; 
		border: 2px solid #008CBA;
	  }
  
	  .button2:hover {
		background-color: #008CBA;
		color: white;
	  }
	</style>
  	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>TSM: Class Selector</title>
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
		<div class='checkboxgroup' >
		<p style="font-size: 16px;" >Select Test Classes for Suite.</p>
			${content}
		</div>
		<br/>
		<button class="button button2" onclick="myFunction()">Submit</button>
	</body>
	</html>`;
}

// this method is called when your extension is deactivated
export function deactivate() {}
