# Distributed database
A simple distributed database consists of a master, 2 tablet servers that can serve any number of clients
- Master is responsible for load balancing. Periodic data retrieval and redistributing data among tablet servers.
- Tablet servers receives requests from clients and process it. They receive load balance requests from master and handle it by sending the local changes then receiving the new data.
- Client servers receives http requests and send them to the appropriate tablet server. They update their metadata on receiving any response. They might send requests to tablet servers using an outdated metadata; at this case the tablet server responds with an 'outdated' and the new metadata object. The client server then uses the new metadata and fires the request again.
- The loadbalance event is fired by the master every 1 hr. It's hardcoded in `websocket.js` and you can change it.
- The above points are just a brief for the system workflow.

# Project structure
- Each directory in the directories [master, tablet, client] is a whole application representing a server.
# Init project
- Install Node.js, MongoDB server
- Clone the repo
- At each directory in the directories [master, tablet, client] run `npm install`
- For each directory copy the `.env.example` and paste it in a `config.env` file.
- At master and tablet directories you need to run `node utils/generatePublicAndPrivateKeys.js` to generate the public and private keys that will be used for signing auth tokens
- At master directory run `node utils/signJwt.js 1 tablet`, copy the result token and paste it in the `config.env` of the tablet in the field `MASTER_ACCESS_TOKEN_TABLET_1`
- At master directory run `node utils/signJwt.js 2 tablet`, copy the result token and paste it in the `config.env` of the tablet in the field `MASTER_ACCESS_TOKEN_TABLET_2`
- At tablet directory run `node utils/signJwt.js 1 client`, copy the result token and paste it in the `config.env` of the client in the field `MASTER_ACCESS_TOKEN_TABLET_1`
- At master/models you need to have a directory called seeds containing a file called `products.js` that exports an array of documents that would be seeded in the master db at the very beginning. The array should be in the mongodb style e.g: [{key: field,...}, {key1: field,...}]
- Check that ports 3000,5000,6000,7000,8000 are not in use or change them in the `config.env` files
- Run `npm run develop` at master directory
- Run `npm run develop_tablet_1` at tablet directory
- Run `npm run develop_tablet_2` at tablet directory
- Run `npm run develop_client_1` at client directory
- Run `npm run develop_client_2` at client directory
