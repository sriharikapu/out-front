'use strict'
const BigNumber = require('bignumber.js');
const process = require('process');
const FlexContract = require('flex-contract');
const fs = require('fs');
const path = require('path');
const SECRETS = require('../../secrets.json');

function loadArtifact(name) {
    return fs.readFileSync(path.resolve(__dirname, `../build/${name}`));
}

const SIPHON_ABI = JSON.parse(loadArtifact('Siphon.abi'));
const SIPHON_BYTECODE = loadArtifact('Siphon.bin');
const TOKEN_ABI = JSON.parse(loadArtifact('TronToken.abi'));
const TOKEN_BYTECODE = loadArtifact('TronToken.bin');
const BALANCE_CHANGER_ABI = JSON.parse(loadArtifact('TestBalanceChanger.abi'));
const BALANCE_CHANGER_BYTECODE = loadArtifact('TestBalanceChanger.bin');
const CRAP_DAPP_ABI = JSON.parse(loadArtifact('CrapDapp.abi'));
const CRAP_DAPP_BYTECODE = loadArtifact('CrapDapp.bin');
const DEPLOYMENTS_PATH = path.resolve(__dirname, '../deployments.json');
const DEPLOYMENTS = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH));

const TESTNET_INITIAL_TOKEN_BALANCE = new BigNumber('1337e18').toString(10);

const DEPLOYER = SECRETS.accounts.deployer;
const USER = SECRETS.accounts.user;
const NETWORK = process.env.NETWORK || 'ropsten';
const MAX_UINT256 = new BigNumber(2).pow(256).minus(1).toString(10);
const GAS_PRICE = process.env.GAS_PRICE || undefined;

(async () => {
    const addresses = {};
    console.log(`Using network ${NETWORK}`);

    const siphon = new FlexContract(SIPHON_ABI, { network: NETWORK, bytecode: `0x${SIPHON_BYTECODE}` });
    console.log('Deploying Siphon...');
    await siphon.new().send({ key: DEPLOYER.privateKey, gasPrice: GAS_PRICE });
    console.log(`Deployed Siphon at ${siphon.address}`);
    addresses['Siphon'] = siphon.address;

    const dapp = new FlexContract(CRAP_DAPP_ABI, { network: NETWORK, bytecode: `0x${CRAP_DAPP_BYTECODE}` });
    console.log('Deploying CrapDapp...');
    await dapp.new().send({ key: DEPLOYER.privateKey, gasPrice: GAS_PRICE });
    console.log(`Deployed CrapDapp at ${dapp.address}`);
    addresses['CrapDapp'] = dapp.address;

    if (NETWORK !== 'main') {
        const bc = new FlexContract(BALANCE_CHANGER_ABI, { network: NETWORK, bytecode: `0x${BALANCE_CHANGER_BYTECODE}` });
        console.log('Deploying TestBalanceChanger...');
        await bc.new().send({ key: DEPLOYER.privateKey });
        console.log(`Deployed TestBalanceChanger at ${bc.address}`);
        addresses['TestBalanceChanger'] = bc.address;

        const token = new FlexContract(TOKEN_ABI, { network: NETWORK, bytecode: `0x${TOKEN_BYTECODE}` });
        console.log('Deploying TronToken...');
        await token.new().send({ key: DEPLOYER.privateKey });
        console.log(`Deployed TestToken at ${token.address}`);
        addresses['TronToken'] = token.address;
        console.log(`Minting ${TESTNET_INITIAL_TOKEN_BALANCE} tokens to ${USER.address}...`);
        await token.mint(TESTNET_INITIAL_TOKEN_BALANCE).send({ key: USER.privateKey });

        console.log(`Minting ${TESTNET_INITIAL_TOKEN_BALANCE} tokens to ${bc.address}...`);
        await bc.mint(token.address, TESTNET_INITIAL_TOKEN_BALANCE).send({ key: DEPLOYER.privateKey });
        console.log(`Approving the siphon contract from ${bc.address}...`)
        await bc.approve(token.address, siphon.address, MAX_UINT256).send({ key: DEPLOYER.privateKey });

        console.log(`Approving the dapp at ${dapp.address}...`);
        await token.approve(dapp.address, MAX_UINT256).send({ key: USER.privateKey });
    }

    DEPLOYMENTS[NETWORK] = Object.assign(DEPLOYMENTS[NETWORK] || {}, addresses);
    fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(DEPLOYMENTS, null, '    '));
})();
