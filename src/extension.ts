// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';
import * as vscode from 'vscode';
const { exec } = require( 'child_process' );
const fs = require('fs') 

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('salesforce-testsuite-generator.createtestsuite', async() => {
		
		let tsInput = await vscode.window.showInputBox({ placeHolder: 'Enter desired name.' });
		
		if( tsInput ){
			
			var testSuiteName = tsInput;
			var items: String[] = [];
			//let currentPanel: vscode.WebviewPanel | undefined = undefined;
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
			foo.on('close', (data: any)=> {
				getFilteredData( items ).then( function( realData ) {
					if( realData.length > 5 ){
						try{
							getListOfElements(realData).then(function( content ){
								createWebView( content, 'submit_classes', dirPath, testSuiteName );
							});
							
						}
						catch( err ){
							console.log('err_->'+err.message);
						}
						
					}
				});
				
			});
		}
	});

	let exportTestSuites = vscode.commands.registerCommand('salesforce-testsuite-generator.exporttestsuites', async() => {
		getAllTestSuiteNames( true ).then(function( items ){
			getListOfElements(items).then(function( content ){
				createWebView( content, 'submit_ts', '', '' );
			});
		});
	});

	let runTestSuite = vscode.commands.registerCommand('salesforce-testsuite-generator.runtestsuite', async() => {
		getAllTestSuiteNames( false );
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(runTestSuite);
	context.subscriptions.push(exportTestSuites);
	
}

function createWebView( content, command:String, dirPath:String, testSuiteName:String ){

	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	var tabName, tabLabel;
	if( command == 'submit_classes' ){
		tabName = 'classselector';
		tabLabel = 'TSM: Class Selector';
	}
	else{
		tabName = 'tsselector';
		tabLabel = 'TSM: Test Suite Selector';
	}
	currentPanel = vscode.window.createWebviewPanel(
		tabName,
		tabLabel,
		vscode.ViewColumn.One,
		{
			enableScripts: true
		}
	);
	currentPanel.webview.html = getWebviewContent(content, command);

	currentPanel.webview.onDidReceiveMessage(

		message => {
			var selectedItems = message.text.split(' ');
			selectedItems.pop();
			switch (message.command) {
				case 'submit_classes':
					return createAndDeployTS( selectedItems, dirPath, testSuiteName );
				case 'submit_ts':
					return exportAllTestSuites( selectedItems );
			}
		},
		undefined
	);

}

function createAndDeployTS( selectedClasses:String[], dirPath:String, testSuiteName:String ){
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Creating and Deploying your Test Suite.",
		cancellable: false
		}, () => {
			vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		var p = new Promise(resolve => {
			createTestSuiteContent( selectedClasses ).then(function( fileData ){
				if (!fs.existsSync(dirPath)){
					fs.mkdirSync(dirPath);
				}
				var fullPath = dirPath+'\\'+testSuiteName+'.testSuite-meta.xml';
				fs.writeFile(fullPath, fileData, (err) => { 

					// In case of a error throw err. 
					if (err) throw err; 
					else{
						deployTsToOrg( fullPath ).then(async function( Code ){
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
				return startTestSuiteRun( testSuiteName );
			}
		}
	});
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

function createTestSuiteContent( selectedClasses:String[] ){
	var dataToReturn = '<?xml version="1.0" encoding="UTF-8"?>\n';
	dataToReturn += '<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">\n';
	return new Promise((resolve, reject) => {
		setTimeout(() => {
		for( var i=0; i<selectedClasses.length; i++ ){
			dataToReturn += '	<testClassName>'+selectedClasses[i].replace(/(?:\r\n|\r|\n)/g,'')+'</testClassName>\n';
		}
		dataToReturn += '</ApexTestSuite>';
		resolve(dataToReturn);
	},500);
	});

}

function deployTsToOrg( dir:String ){

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			dir = "\""+dir+"\"";
			let foo = exec("sfdx force:source:deploy --json -p "+dir,{
				maxBuffer: 1024 * 1024 * 6,
				cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
			});

			foo.on('close', (Code: any)=> {
				resolve(Code);
			});
		},500);
	});

}

function startTestSuiteRun( testSuiteName ){

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Running Test Suite.",
		cancellable: false
		}, () => {
			var outputMsg:String = '';
		var p = new Promise(resolve => {
			runTestSuit( testSuiteName ).then( function( returnValues ) {
				if( returnValues[0] == 0 ){
					vscode.window.showInformationMessage("Test Suite Ran successfully.");
				}
				else{
					vscode.window.showErrorMessage('Error Occurred when running Test Suite.');
				}
				const outputChannel = vscode.window.createOutputChannel('Test Suite Manager');
				if( outputMsg == '' ){
					outputChannel.append( returnValues[1] );
				}
				outputChannel.show();	
				return resolve(true);
			} );
		})
		return p;
	});

}

function runTestSuit(dir:String){
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			var outPutRes = '';
			dir = "\""+dir+"\"";
			let foo = exec("sfdx force:apex:test:run -s "+dir+" -c -r human",{
				maxBuffer: 1024 * 1024 * 6,
				cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
			});

			foo.stdout.on("data",(dataArg : any)=> {
				outPutRes += dataArg;
			});

			foo.on('close', (Code: any)=> {
				const dataToSend = [ Code,outPutRes ];
				resolve( dataToSend );
			});
		},500);
	});
}

function getAllTestSuiteNames( onlyGetNames:Boolean ){
	let allTestSuites: vscode.QuickPickItem[] = [];

	return new Promise(resolve => {
		let foo = exec("sfdx force:data:soql:query -q \"Select TestSuiteName From ApexTestSuite ORDER BY TestSuiteName\"",{
			maxBuffer: 1024 * 1024 * 6,
			cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
		});

		foo.stdout.on("data",(dataArg : any)=> {
			try{
				allTestSuites = allTestSuites.concat( dataArg.split('\n') );
			}
			catch( err ){
				console.log( 'err-->'+err.message );
			}
		});

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting All TestSuite Names.",
			cancellable: false
			}, () => {
			var p = new Promise(resolve => {
				foo.on('close', (data: any)=> {
					resolve( true );
				});
			});
			return p;
		});

		foo.on('close', (data: any)=> {
			
			getFilteredData( allTestSuites ).then(function ( realData ) {
				return realData;
			}).then( async function( realData ) {
				if( onlyGetNames ){
					return resolve(realData);
				}
				vscode.window.showQuickPick(realData).then(selection => {
					if (!selection) {
						return;
					}
					return resolve(startTestSuiteRun( selection ));
				});
			});
		});
	});

	
}

function exportAllTestSuites( selectedItems ){
	vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Retrieving Test Suites.",
		cancellable: false
		}, () => {
		var p = new Promise(resolve => {
			getPackageXml( selectedItems ).then( function( fileData ) {
				const pathForTestXML = vscode.workspace.workspaceFolders[0].uri.fsPath+'\\testPackage.xml';
				fs.writeFile(pathForTestXML, fileData, (err) => { 

					// In case of a error throw err. 
					if (err) throw err; 
					else{
						retrieveSource(pathForTestXML).then(async function( Code ){
							if( Code == 0 ){
								vscode.window.showInformationMessage( 'Test Suites retrieved Successfully.' );
							}
							else{
								vscode.window.showErrorMessage('Error Occurred when retrieving Test Suites.');
							}
							fs.unlinkSync(pathForTestXML);
							return resolve(true);
						});
					}
				}) 
			});
		});
		return p;
	});
	

}

function getPackageXml( selectedItems ){

	return new Promise(resolve => {
		var fileData = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
		fileData+= '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
		fileData+= '	<types>\n';
		for( var i=0; i<selectedItems.length; i++ ){
			fileData += '		<members>'+selectedItems[i]+'</members>\n';
		}
		fileData += '		<name>ApexTestSuite</name>\n';
		fileData += '	</types>\n';
		fileData += '	<version>50.0</version>\n';
		fileData += '</Package>';

		return resolve(fileData);
	});
	
}

function retrieveSource( dir ){

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			dir = "\""+dir+"\"";
			let foo = exec("sfdx force:source:retrieve -x "+dir,{
				maxBuffer: 1024 * 1024 * 6,
				cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
			});

			foo.on('close', (Code: any)=> {
				resolve(Code);
			});
		},500);
	});

}

function getWebviewContent( content, itemName ) {
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
		var myFunction = function(value,object) {
			var checkedBoxes = document.querySelectorAll('input[name=mycheckboxes]:checked');
			var classes = '';
			for( var i=0; i<checkedBoxes.length; i++ ){
				classes += checkedBoxes[i].id+' ';
			}
			const vscode = acquireVsCodeApi();
			vscode.postMessage({
				command: value,
				text: classes
			})
		}
	</script>
		<div class='checkboxgroup' >
		<p style="font-size: 16px;" >Select Items below:</p>
			${content}
		</div>
		<br/>
		<button class="button button2" data-arg1='classes' onclick="myFunction(\'${itemName}\',this)">Submit</button>
	</body>
	</html>`;
}

// this method is called when your extension is deactivated
export function deactivate() {}
