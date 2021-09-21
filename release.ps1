rm -R release/js
rm -R release/public
rm release/rspiker.exe
rm release/config.json
$version = Read-Host 'version ?'
cargo build
cp -R js release/js
cp -R public release/public
cp target/debug/rspiker.exe release/rspiker.exe
cp config.json release/config.json
Compress-Archive -Path release\* -DestinationPath release-$version.zip