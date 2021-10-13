rm -R release/js
rm -R release/public
rm release/rspiker.exe
rm release/config.json
rm release/mcstream_wrapper.dll
$version = Read-Host 'version ?'
cargo build
cp -R js release/js
cp -R public release/public
cp target/debug/rspiker.exe release/rspiker.exe
cp config.json release/config.json
cp mcstream_wrapper.dll release/mcstream_wrapper.dll
Compress-Archive -Path release\* -DestinationPath rspiker-release-$version.zip