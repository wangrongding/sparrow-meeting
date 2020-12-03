<template>
    <div id="app">
        <container />
        <!-- <oneToOne /> -->
    </div>
</template>

<script>
import oneToOne from './components/oneToOne.vue';
import container from './components/container.vue';

export default {
    name: 'App',
    components: {
        container,
        oneToOne,
    },
};
</script>

<style lang="less">
body {
    margin: 0;
    padding: 0;
}
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    /* margin-top: 60px; */
}
</style>
